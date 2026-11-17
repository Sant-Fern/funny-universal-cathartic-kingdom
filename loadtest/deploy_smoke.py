"""Deployment smoke that can coexist with other players in a room."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect

from loadtest.smoke import socket_url


async def run(url):
    async with httpx.AsyncClient(base_url=url, timeout=10, trust_env=False) as client:
        page = await client.get("/")
        page.raise_for_status()
        assert "Funny Universal" in page.text
        for attempt in range(20):
            response = await client.post("/api/join", json={"name": "QA-pipeline", "mode": "race"})
            if response.status_code != 503:
                response.raise_for_status()
                break
            await asyncio.sleep(1)
        else:
            raise RuntimeError("No game capacity available")
        start = time.perf_counter()
        async with connect(socket_url(url, response.json()), origin=url, proxy=None, max_size=2**20) as socket:
            welcome = json.loads(await asyncio.wait_for(socket.recv(), 10))
            assert welcome["type"] == "welcome" and welcome["mode"] == "race"
            state = json.loads(await asyncio.wait_for(socket.recv(), 10))
            assert any(player["id"] == welcome["playerId"] and not player["bot"] for player in state["players"])
            await socket.send(json.dumps({"type": "ping", "timestamp": 123}))
            async with asyncio.timeout(10):
                while json.loads(await socket.recv()).get("type") != "pong":
                    pass
            board = await client.get("/api/leaderboard?mode=race")
            board.raise_for_status()
            assert "items" in board.json()
            return {"utc": datetime.now(timezone.utc).isoformat(), "url": url, "status": "passed",
                    "mode": "race", "humans": state["humans"], "welcomeAndPingMs": (time.perf_counter()-start)*1000}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", default="integrator-smoke.json")
    args = parser.parse_args()
    data = asyncio.run(run(args.url.rstrip("/")))
    Path(args.output).write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
