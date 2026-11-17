"""Same-origin matchmaking and WebSocket routing to Agones GameServers."""
import asyncio
import contextlib
import ipaddress
import json
import os
from pathlib import Path
import re
import ssl
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from server.app import JoinRequest
from server.game import CONFIG

NAMESPACE = os.environ.get("POD_NAMESPACE", "pogo")
SERVICE_ACCOUNT = Path("/var/run/secrets/kubernetes.io/serviceaccount")
GAME_NAME = re.compile(r"^pogo-(?:race|eliminations)-[a-z0-9-]{1,80}$")


class Router:
    def __init__(self, client, kube):
        self.client, self.kube = client, kube
        self.cache = {}
        self.locks = {mode: asyncio.Lock() for mode in ("race", "eliminations")}
        self.connections = 0
        self.allocations = 0
        self.preferred = {}
        self.games = {}
        self.blocked_until = {}

    async def api(self, method, path, **kwargs):
        # Reread projected short-lived service-account tokens after rotation.
        headers = {"Authorization": "Bearer " + (SERVICE_ACCOUNT / "token").read_text().strip()}
        response = await self.kube.request(method, path, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()

    async def target(self, name):
        if not GAME_NAME.fullmatch(name):
            raise HTTPException(404, "Partida desconocida.")
        cached = self.cache.get(name)
        if cached and cached[1] > time.monotonic():
            return cached[0]
        pod = await self.api("GET", f"/api/v1/namespaces/{NAMESPACE}/pods/{name}")
        if pod.get("metadata", {}).get("labels", {}).get("app") != "pogo-game":
            raise HTTPException(404, "Partida desconocida.")
        address = ipaddress.ip_address(pod["status"]["podIP"])
        if not address.is_private or address.is_loopback or address.is_link_local:
            raise HTTPException(503, "La partida todavía se prepara.")
        target = f"http://{address}:8000"
        self.cache[name] = (target, time.monotonic() + 15)
        return target

    async def reserve(self, name, body):
        target = await self.target(name)
        response = await self.client.post(target + "/api/join", json=body.model_dump())
        if response.status_code == 409:
            return None
        response.raise_for_status()
        result = response.json()
        result.update(websocketPath=f"/ws/{name}", mode="agones", gameServer=name)
        return result

    async def join(self, body):
        mode = "race" if body.mode == "observation" else body.mode
        preferred = self.preferred.get(mode)
        if preferred:
            try:
                result = await self.reserve(preferred, body)
                if result:
                    return result
            except (httpx.HTTPError, KeyError):
                pass
            self.blocked_until[preferred] = time.monotonic()+2
            if self.preferred.get(mode) == preferred:
                self.preferred.pop(mode, None)
        # Keep requests out of an unbounded serial allocation queue. Existing
        # rooms reserve slots atomically and never need this selection lock.
        try:
            await asyncio.wait_for(self.locks[mode].acquire(), timeout=.1)
        except TimeoutError as error:
            raise HTTPException(503, "Se está preparando otra sala.", headers={"Retry-After": "2"}) from error
        try:
            preferred = self.preferred.get(mode)
            if preferred:
                try:
                    result = await self.reserve(preferred, body)
                    if result:
                        return result
                except (httpx.HTTPError, KeyError):
                    pass
                self.blocked_until[preferred] = time.monotonic()+2
            now = time.monotonic()
            self.blocked_until = {name: expiry for name, expiry in self.blocked_until.items() if expiry > now}
            cached = self.games.get(mode)
            if cached and cached[0] > now:
                games = cached[1]
            else:
                response = await self.api("GET", f"/apis/agones.dev/v1/namespaces/{NAMESPACE}/gameservers",
                    params={"labelSelector": f"agones.dev/fleet=pogo-{mode}"})
                games = response["items"]
                self.games[mode] = (now+1, games)
            for game in sorted(games, key=lambda game: -int(game.get("status", {}).get("counters", {}).get("players", {}).get("count", 0))):
                if game.get("status", {}).get("state") != "Allocated":
                    continue
                name = game["metadata"]["name"]
                if name in self.blocked_until:
                    continue
                if int(game.get("status", {}).get("counters", {}).get("players", {}).get("count", 0)) >= 10:
                    continue
                try:
                    result = await self.reserve(game["metadata"]["name"], body)
                    if result:
                        self.preferred[mode] = name
                        return result
                except (httpx.HTTPError, KeyError):
                    continue
                self.blocked_until[name] = time.monotonic()+2
            if not any(game.get("status", {}).get("state") == "Ready" for game in games):
                raise HTTPException(503, "Se está ampliando la capacidad.", headers={"Retry-After": "2"})
            allocation = await self.api("POST", f"/apis/allocation.agones.dev/v1/namespaces/{NAMESPACE}/gameserverallocations",
                                        json={"apiVersion": "allocation.agones.dev/v1", "kind": "GameServerAllocation",
                                              "spec": {"required": {"matchLabels": {"agones.dev/fleet": f"pogo-{mode}"}}}})
            status = allocation.get("status", {})
            if status.get("state") != "Allocated":
                self.games.pop(mode, None)
                raise HTTPException(503, "Se está ampliando la capacidad.", headers={"Retry-After": "2"})
            self.allocations += 1
            for _ in range(4):
                try:
                    result = await self.reserve(status["gameServerName"], body)
                    if result:
                        self.preferred[mode] = status["gameServerName"]
                        return result
                except (httpx.HTTPError, KeyError):
                    await asyncio.sleep(.2)
            raise HTTPException(503, "La nueva partida todavía se prepara.")
        finally:
            self.locks[mode].release()


@asynccontextmanager
async def lifespan(app):
    context = ssl.create_default_context(cafile=str(SERVICE_ACCOUNT / "ca.crt"))
    async with httpx.AsyncClient(timeout=4, limits=httpx.Limits(max_connections=200)) as client:
        async with httpx.AsyncClient(base_url="https://kubernetes.default.svc", verify=context, timeout=5) as kube:
            app.state.router = Router(client, kube)
            yield


app = FastAPI(title="Pogo · gateway", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "agones"}


@app.get("/api/config")
async def config():
    return CONFIG


@app.get("/api/leaderboard")
async def leaderboard(mode: str = "eliminations"):
    if mode not in ("race", "eliminations"):
        raise HTTPException(400, "Modo inválido")
    endpoint = os.environ.get("LEADERBOARD_URL")
    if not endpoint:
        raise HTTPException(503, "La clasificación todavía se prepara.")
    try:
        response = await app.state.router.client.get(endpoint, params={"mode": mode})
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as error:
        raise HTTPException(503, "No se pudo consultar la clasificación. Vuelve a intentarlo.") from error


@app.get("/metrics")
async def metrics():
    router = app.state.router
    return Response(f"# TYPE pogo_gateway_ccu gauge\npogo_gateway_ccu {router.connections}\n"
                    f"# TYPE pogo_allocations_total counter\npogo_allocations_total {router.allocations}\n",
                    media_type="text/plain; version=0.0.4")


@app.post("/api/join")
async def join(body: JoinRequest):
    try:
        return await app.state.router.join(body)
    except httpx.HTTPError as error:
        raise HTTPException(503, "No se pudo asignar la partida. Vuelve a intentarlo.") from error


@app.websocket("/ws/{name}")
async def proxy(ws: WebSocket, name: str):
    origin = ws.headers.get("origin")
    host = ws.headers.get("host")
    if origin and origin not in (f"http://{host}", f"https://{host}"):
        await ws.close(code=1008)
        return
    token = ws.query_params.get("token", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,100}", token):
        await ws.close(code=1008)
        return
    router = app.state.router
    try:
        target = await router.target(name)
        async with connect(target.replace("http://", "ws://") + f"/ws?token={token}",
                           max_size=2**20, proxy=None, open_timeout=5) as remote:
            await ws.accept()
            router.connections += 1

            async def upstream():
                while True:
                    data = await ws.receive_text()
                    if len(data.encode()) > 2048:
                        await ws.close(code=1009)
                        return
                    await remote.send(data)

            async def downstream():
                async for data in remote:
                    await ws.send_text(data)

            tasks = [asyncio.create_task(upstream()), asyncio.create_task(downstream())]
            try:
                await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                router.connections -= 1
    except (httpx.HTTPError, HTTPException, ConnectionClosed, OSError, KeyError, WebSocketDisconnect):
        pass
    finally:
        with contextlib.suppress(RuntimeError, WebSocketDisconnect):
            await ws.close(code=1000)
