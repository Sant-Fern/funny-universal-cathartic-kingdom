from fastapi.testclient import TestClient
import asyncio
import contextlib
import httpx

from server.app import create_app, Runtime
from server import cloud


def test_cloud_room_rejects_wrong_mode_and_metrics_count_real_connections(monkeypatch):
    monkeypatch.setenv("MATCH_MODE", "race")
    with TestClient(create_app()) as client:
        assert client.post("/api/join", json={"name": "Ana"}).status_code == 409
        token = client.post("/api/join", json={"name": "Ana", "mode": "race"}).json()["token"]
        with client.websocket_connect(f"/ws?token={token}") as ws:
            assert ws.receive_json()["mode"] == "race"
            health = client.get("/health").json()
            assert health["humans"] == 1 and health["mode"] == "race"
            text = client.get("/metrics").text
            assert 'pogo_ccu{mode="race"} 1' in text
            assert 'pogo_ccu{mode="eliminations"}' not in text
            assert "pogo_tick_seconds_bucket" in text
        assert 'pogo_ccu{mode="race"} 0' in client.get("/metrics").text


def test_agones_retries_startup_and_transient_health_failure(monkeypatch):
    monkeypatch.setenv("AGONES_SDK_HTTP_PORT", "9358")
    monkeypatch.setenv("MATCH_MODE", "race")
    calls = {"ready": 0, "health": 0}

    async def scenario():
        recovered = asyncio.Event()

        def respond(request):
            if request.url.path == "/ready":
                calls["ready"] += 1
                return httpx.Response(503 if calls["ready"] == 1 else 200, json={})
            if request.url.path == "/health":
                calls["health"] += 1
                if calls["health"] == 1:
                    return httpx.Response(500, json={})
                recovered.set()
            return httpx.Response(200, json={})

        real_client, real_sleep = httpx.AsyncClient, asyncio.sleep
        monkeypatch.setattr(cloud.httpx, "AsyncClient", lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(respond)))

        async def fast_sleep(_):
            await real_sleep(0)

        monkeypatch.setattr(cloud.asyncio, "sleep", fast_sleep)
        task = asyncio.create_task(cloud.lifecycle(Runtime()))
        try:
            await asyncio.wait_for(recovered.wait(), 2)
            assert not task.done()
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        assert calls["ready"] == 2 and calls["health"] >= 2

    asyncio.run(scenario())
