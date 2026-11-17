"""Local matchmaking with one shared match per game mode."""
import asyncio
import contextlib
import json
import logging
import math
import os
import secrets
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from server.game import Arena, CONFIG
from server.cloud import lifecycle as agones_lifecycle, metrics
from server.results import payload as result_payload, worker as results_worker

log = logging.getLogger("pogo")


class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=16, pattern=r"^[\w .\-]+$")
    mode: Literal["eliminations", "race", "observation"] = "eliminations"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    type: str = Field(pattern="^input$")
    seq: int = Field(ge=0, le=2**31-1)
    moveX: float = Field(ge=-1, le=1)
    moveZ: float = Field(ge=-1, le=1)
    yaw: float = Field(ge=-math.pi*2, le=math.pi*2)
    pitch: float = Field(ge=-0.7, le=0.7)
    fire: bool
    jumpPower: float | None = Field(default=None, ge=0, le=1)
    jumpHeld: bool = False
    power: float = Field(default=.6,ge=0,le=1)
    bottle: Literal["standard", "heavy"] = "standard"


@dataclass
class Connection:
    websocket: WebSocket
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=1))
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, data):
        async with self.lock:
            # Shared tick snapshots are encoded once per room, not once per player.
            encoded = data if isinstance(data, str) else json.dumps(data, separators=(",", ":"), ensure_ascii=False)
            await asyncio.wait_for(self.websocket.send_text(encoded), timeout=2)


@dataclass
class Room:
    arena: Arena
    connections: dict = field(default_factory=dict)


class Runtime:
    def __init__(self):
        self.cloud_mode = os.environ.get("MATCH_MODE")
        if self.cloud_mode and self.cloud_mode not in ("eliminations", "race"):
            raise ValueError("MATCH_MODE must be eliminations or race")
        self.rooms = {mode: Room(Arena(mode=mode)) for mode in
                      ((self.cloud_mode,) if self.cloud_mode else ("eliminations", "race"))}
        self.tokens = {}
        self.ticks = 0
        self.tick_work = 0
        self.tick_samples = 0
        self.tick_total = 0
        self.tick_bounds = (.001, .0025, .005, .01, .02, .05, .1, .25, .5, 1)
        self.tick_buckets = [0] * len(self.tick_bounds)
        self.dropped = 0
        self.last_tick = time.monotonic()
        self.results_queue = asyncio.Queue(maxsize=32)
        self.results_pending = self.results_saved = self.results_failures = 0
        self.results_enqueued = set()

    async def loop(self):
        interval = 1 / CONFIG["tickRate"]
        next_tick = time.monotonic()
        while True:
            started = time.perf_counter()
            now = time.monotonic()
            self.tokens = {t: v for t, v in self.tokens.items() if v[1] > now}
            active_tick = any(room.connections for room in self.rooms.values())
            for room in self.rooms.values():
                if not room.connections:
                    continue
                room.arena.step(interval)
                if (os.environ.get("RESULTS_FUNCTION") and room.arena.finished
                        and room.arena.id not in self.results_enqueued):
                    result = result_payload(room.arena)
                    if result["players"] and not self.results_queue.full():
                        self.results_queue.put_nowait(result)
                        self.results_pending += 1
                        self.results_enqueued.add(room.arena.id)
                if room.connections:
                    snapshot = json.dumps(room.arena.snapshot(), separators=(",", ":"), ensure_ascii=False)
                    for conn in room.connections.values():
                        if conn.queue.full():
                            conn.queue.get_nowait()
                            self.dropped += 1
                        conn.queue.put_nowait(snapshot)
            self.ticks += 1
            self.tick_work = time.perf_counter() - started
            self.last_tick = time.monotonic()
            if active_tick:
                self.tick_samples += 1
                self.tick_total += self.tick_work
                for index, bound in enumerate(self.tick_bounds):
                    self.tick_buckets[index] += self.tick_work <= bound
            next_tick += interval
            if next_tick < now - interval:
                next_tick = now
            await asyncio.sleep(max(0, next_tick-time.monotonic()))


def create_app():
    runtime = Runtime()

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(runtime.loop())
        sdk_task = asyncio.create_task(agones_lifecycle(runtime))
        results_task = asyncio.create_task(results_worker(runtime))
        try:
            yield
        finally:
            for pending in (task, sdk_task, results_task):
                pending.cancel()
            await asyncio.gather(task, sdk_task, results_task, return_exceptions=True)

    app = FastAPI(title="Funny Universal Cathartic Kingdom · servidor local", lifespan=lifespan)
    app.state.runtime = runtime

    @app.get("/health")
    async def health():
        humans = sum(room.arena.humans for room in runtime.rooms.values())
        active_rooms = sum(bool(room.connections) for room in runtime.rooms.values())
        return {"status": "ok", "mode": runtime.cloud_mode or "local", "humans": humans,
                "reserved": sum(v[1] > time.monotonic() for v in runtime.tokens.values()),
                "finished": all(room.arena.finished for room in runtime.rooms.values()),
                "bots": 2*CONFIG["teamSize"]*max(1, active_rooms)-humans,
                "tickRateTarget": CONFIG["tickRate"]}

    @app.get("/metrics")
    async def prometheus():
        return Response(metrics(runtime), media_type="text/plain; version=0.0.4")

    @app.get("/api/config")
    async def config():
        return CONFIG

    @app.post("/api/join")
    async def join(body: JoinRequest):
        now = time.monotonic()
        runtime.tokens = {t: v for t, v in runtime.tokens.items() if v[1] > now}
        mode = "race" if body.mode == "observation" else body.mode
        if mode not in runtime.rooms:
            raise HTTPException(409, "Este servidor aloja otro modo de juego.")
        room = runtime.rooms[mode]
        if room.arena.finished and not room.connections:
            room.arena = Arena(mode=mode)
        if room.arena.finished:
            raise HTTPException(409, "La partida terminó. Espera a que los jugadores vuelvan al inicio.")
        reserved = sum(reserved_mode == mode for _, _, reserved_mode in runtime.tokens.values())
        if room.arena.humans + reserved >= 2*CONFIG["teamSize"]:
            raise HTTPException(409, "La sala está llena (10 jugadores).")
        token = secrets.token_urlsafe(32)
        runtime.tokens[token] = (body.name, now + 30, mode)
        return {"token": token, "websocketPath": "/ws", "expiresIn": 30, "mode": "local"}

    @app.websocket("/ws")
    async def websocket(ws: WebSocket):
        # Same-origin browser connections only; local HTTP clients may omit Origin.
        origin = ws.headers.get("origin")
        allowed = {f"http://{ws.headers.get('host')}", f"https://{ws.headers.get('host')}"}
        allowed.update(os.environ.get("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(","))
        token = ws.query_params.get("token", "")
        reservation = runtime.tokens.pop(token, None)
        if origin and origin not in allowed:
            await ws.close(code=1008)
            return
        if reservation is None or reservation[1] <= time.monotonic():
            await ws.close(code=1008)
            return
        await ws.accept()
        room = runtime.rooms[reservation[2]]
        arena = room.arena
        try:
            player = arena.join(reservation[0])
        except ValueError as error:
            await ws.send_json({"type": "error", "message": str(error)})
            await ws.close(code=1008)
            return
        conn = Connection(ws)
        room.connections[player.id] = conn

        async def sender():
            try:
                while True:
                    await conn.send(await conn.queue.get())
            except (TimeoutError, RuntimeError, WebSocketDisconnect):
                with contextlib.suppress(Exception):
                    await ws.close(code=1011)

        sender_task = None
        window_start, count = time.monotonic(), 0
        try:
            await conn.send({"type": "welcome", "playerId": player.id, "team": player.team, "yaw": player.yaw,
                             "mode": arena.mode, "config": CONFIG})
            await conn.send(arena.snapshot())
            sender_task = asyncio.create_task(sender())
            while True:
                raw = await ws.receive_text()
                if len(raw.encode("utf-8")) > 2048:
                    await ws.close(code=1009)
                    break
                now = time.monotonic()
                if now-window_start >= 1:
                    window_start, count = now, 0
                count += 1
                if count > 60:
                    await ws.close(code=1008)
                    break
                try:
                    data = json.loads(raw)
                    if not isinstance(data, dict):
                        raise ValueError("Expected object")
                    if data.get("type") == "ping":
                        stamp = data.get("timestamp")
                        if not isinstance(stamp, (float, int)) or not math.isfinite(stamp):
                            raise ValueError("Invalid timestamp")
                        await conn.send({"type": "pong", "timestamp": stamp})
                    elif data == {"type": "restart"}:
                        if len(room.connections) != 1:
                            await conn.send({"type": "restartDenied", "message": "Hay otros jugadores en esta sala. Puedes salir y cambiar de modo."})
                            continue
                        arena = Arena(mode=arena.mode)
                        player = arena.join(player.name, slot_id=player.id)
                        if not conn.queue.empty():
                            conn.queue.get_nowait()
                        room.arena = arena
                        await conn.send({"type": "restarted", "matchId": arena.id, "yaw": player.yaw})
                    else:
                        arena.apply_input(player.id, Input.model_validate(data))
                except (ValidationError, ValueError, TypeError):
                    await conn.send({"type": "error", "message": "Control inválido: revisa el protocolo."})
        except (TimeoutError, WebSocketDisconnect, RuntimeError):
            pass
        finally:
            if sender_task:
                sender_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await sender_task
            room.connections.pop(player.id, None)
            arena.leave(player.id)
            if not room.connections:
                room.arena = Arena(mode=arena.mode)

    return app


app = create_app()
