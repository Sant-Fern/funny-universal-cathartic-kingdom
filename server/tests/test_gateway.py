import asyncio
import httpx
import pytest
from fastapi import HTTPException

from gateway.app import Router
from server.app import JoinRequest


def test_reuses_reserved_room_without_relisting_kubernetes():
    async def scenario():
        calls = []
        async with httpx.AsyncClient() as client:
            router = Router(client, None)
            name = "pogo-eliminations-abcde-12345"

            async def api(method, path, **kwargs):
                calls.append(method)
                if method == "GET":
                    return {"items": [{"metadata": {"name": name}, "status": {"state": "Ready"}}]}
                return {"status": {"state": "Allocated", "gameServerName": name}}

            async def reserve(game, body):
                assert game == name
                return {"token": body.name}

            router.api, router.reserve = api, reserve
            assert (await router.join(JoinRequest(name="Uno")))["token"] == "Uno"
            assert (await router.join(JoinRequest(name="Dos")))["token"] == "Dos"
            assert calls == ["GET", "POST"]
    asyncio.run(scenario())


def test_capacity_selection_fails_fast_instead_of_building_an_unbounded_queue():
    async def scenario():
        async with httpx.AsyncClient() as client:
            router = Router(client, None)
            await router.locks["race"].acquire()
            try:
                with pytest.raises(HTTPException) as error:
                    await asyncio.wait_for(router.join(JoinRequest(name="Uno", mode="race")), .5)
                assert error.value.status_code == 503
                assert error.value.headers["Retry-After"] == "2"
            finally:
                router.locks["race"].release()
    asyncio.run(scenario())
