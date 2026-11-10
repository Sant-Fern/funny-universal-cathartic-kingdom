"""Black-box HTTP and WebSocket check of one otherwise empty game room."""

import argparse
import asyncio
import json
import math
import secrets
import sys
import time
from contextlib import AsyncExitStack
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import WebSocketException


async def receive(socket, kind, predicate=lambda _: True):
    async with asyncio.timeout(5):
        while True:
            message = json.loads(await socket.recv())
            if message["type"] == "error":
                raise ValueError("El servidor rechazó un mensaje de prueba")
            if message["type"] == kind and predicate(message):
                return message


def socket_url(origin, reservation):
    parts = urlsplit(urljoin(origin, reservation["websocketPath"]))
    base = urlsplit(origin)
    if (parts.scheme, parts.netloc) != (base.scheme, base.netloc):
        raise ValueError("La prueba local requiere un WebSocket del mismo origen")
    query = urlencode([*parse_qsl(parts.query), ("token", reservation["token"])])
    return urlunsplit(("wss" if base.scheme == "https" else "ws", parts.netloc, parts.path, query, ""))


def has_roster(snapshot, ids, mode):
    roster = snapshot["players"]
    return (snapshot["mode"] == mode and snapshot["humans"] == len(ids)
            and snapshot["bots"] == 10 - len(ids) and len(roster) == 10
            and {p["id"] for p in roster if not p["bot"]} == set(ids)
            and (all(p["team"] is None for p in roster) if mode == "eliminations" else
                 sum(p["team"] == 0 for p in roster) == sum(p["team"] == 1 for p in roster) == 5))


async def exchange(socket, seconds):
    pending, samples = {}, []
    snapshots = 0

    async def drain():
        nonlocal snapshots
        async for payload in socket:
            message = json.loads(payload)
            if message["type"] == "snapshot":
                snapshots += 1
            elif message["type"] == "pong" and message["timestamp"] in pending:
                sent = pending.pop(message["timestamp"])
                samples.append(round((time.perf_counter() - sent) * 1000, 3))
            elif message["type"] == "error":
                raise ValueError("El servidor rechazó un control de prueba")
        raise ValueError("La conexión se cerró durante la medición")

    task = asyncio.create_task(drain())
    start = time.perf_counter()
    count = 0
    try:
        while time.perf_counter() - start < seconds:
            if task.done():
                task.result()
            # A controlled input stream at 20 Hz; jump and throw once every 2 s.
            await socket.send(json.dumps({
                "type": "input", "seq": count + 1, "moveX": 0.4, "moveZ": 0.6,
                "yaw": 0, "pitch": 0, "fire": count % 40 == 20,
                "jumpPower": 0.6 if count % 40 == 0 else None,
                "power": 0.6, "bottle": "standard",
            }))
            if count % 20 == 0:
                stamp = len(samples) + len(pending)
                pending[stamp] = time.perf_counter()
                await socket.send(json.dumps({"type": "ping", "timestamp": stamp}))
            count += 1
            # Don't burst past the server rate limit if the probe itself stalls.
            await asyncio.sleep(0.05)
        async with asyncio.timeout(2):
            while pending:
                if task.done():
                    task.result()
                await asyncio.sleep(0.025)
        if task.done():
            task.result()
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    if snapshots < 2 or not samples:
        raise ValueError("Muestras insuficientes de snapshots o RTT")
    return {"inputs": count, "snapshots": snapshots, "rttMs": samples}


async def run(origin, mode, players, seconds, check_web):
    tag = secrets.token_hex(3)
    async with httpx.AsyncClient(base_url=origin, timeout=5, trust_env=False) as http, AsyncExitStack() as stack:
        config = (await http.get("/api/config")).raise_for_status().json()
        if config["teamSize"] != 5:
            raise ValueError("La configuración de la sala no es 5 contra 5")
        if check_web:
            page = (await http.get("/")).raise_for_status()
            if "text/html" not in page.headers.get("content-type", "") or "Funny Universal" not in page.text:
                raise ValueError("La raíz no sirvió la página del juego")

        clients, ids, joins = [], [], []
        match_id = None
        for number in range(1, players + 1):
            start = time.perf_counter()
            response = await http.post("/api/join", json={"name": f"QA-{tag}-{number}", "mode": mode})
            if response.status_code == 409:
                raise ValueError("La sala de prueba está llena o la partida anterior aún no termina de cerrar")
            reservation = response.raise_for_status().json()
            socket = await stack.enter_async_context(connect(
                socket_url(origin, reservation), origin=origin, open_timeout=5,
                close_timeout=1, ping_interval=None, proxy=None,
            ))
            welcome = await receive(socket, "welcome")
            join_ms = round((time.perf_counter() - start) * 1000, 3)
            ids.append(welcome["playerId"])
            snapshot = await receive(socket, "snapshot")
            if not has_roster(snapshot, ids, mode) or (match_id is not None and match_id != snapshot["matchId"]):
                raise ValueError("No coincidieron los jugadores y bots en una sola sala vacía de prueba")
            match_id = snapshot["matchId"]
            joins.append({"humans": number, "bots": 10 - number, "joinToWelcomeMs": join_ms})
            clients.append(socket)

        async with asyncio.TaskGroup() as group:
            tasks = [group.create_task(exchange(socket, seconds)) for socket in clients]
        measurements = [task.result() for task in tasks]
        await clients[-1].close()
        await receive(clients[0], "snapshot", lambda snap: snap["matchId"] == match_id and has_roster(snap, ids[:-1], mode))

    samples = sorted(rtt for client in measurements for rtt in client["rttMs"])
    return {
        "utc": datetime.now(timezone.utc).isoformat(), "origin": origin,
        "scope": "single_room_smoke", "mode": mode, "matchId": match_id,
        "secondsRequested": seconds, "joins": joins, "afterDisconnect": {"humans": players - 1, "bots": 11 - players},
        "rtt": {"count": len(samples), "p95Ms": samples[math.ceil(0.95 * len(samples)) - 1]},
        "clients": measurements,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8080", help="Origen de una instalación propia para pruebas")
    parser.add_argument("--mode", choices=("race", "eliminations"), default="race")
    parser.add_argument("--players", type=int, choices=range(2, 11), default=2)
    parser.add_argument("--seconds", type=int, choices=range(2, 31), default=5)
    parser.add_argument("--check-web", action="store_true", help="Verifica también el HTML del cliente")
    parser.add_argument("--output", type=Path, help="Archivo JSON nuevo para conservar evidencia")
    args = parser.parse_args()
    base = urlsplit(args.url)
    if (base.scheme not in {"http", "https"} or not base.hostname or base.username is not None
            or base.path not in {"", "/"} or base.query or base.fragment):
        parser.error("--url debe ser un origen HTTP(S) sin credenciales, ruta o parámetros")
    try:
        result = asyncio.run(run(args.url.rstrip("/"), args.mode, args.players, args.seconds, args.check_web))
        report = json.dumps(result, indent=2) + "\n"
        if args.output:
            with args.output.open("x", encoding="utf-8") as file:
                file.write(report)
    except* (httpx.HTTPError, WebSocketException, TimeoutError, ValueError, KeyError, OSError) as errors:
        # Don't expose reservation URLs or tokens in CI logs.
        for error in errors.exceptions:
            print(f"Prueba fallida: {error if type(error) is ValueError else type(error).__name__}", file=sys.stderr)
        raise SystemExit(1)
    print(report, end="")


if __name__ == "__main__":
    main()
