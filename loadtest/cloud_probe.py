"""Short multi-room integration probe. Does not replace the PDF's Locust workloads."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect

from loadtest.smoke import socket_url


async def run(args):
    sessions = {}
    errors = []
    active = peak = 0
    samples = []
    start = time.monotonic()
    joined = asyncio.Event()
    async with httpx.AsyncClient(base_url=args.url, timeout=10, trust_env=False,
                                 limits=httpx.Limits(max_connections=args.players)) as client:
        async def player(index):
            nonlocal active, peak
            await asyncio.sleep(index / args.rate)
            mode = "race" if index % 2 else "eliminations"
            began = time.monotonic()
            try:
                for _ in range(25):
                    response = await client.post("/api/join", json={"name": f"QA-{index}", "mode": mode})
                    if response.status_code != 503:
                        response.raise_for_status()
                        break
                    await asyncio.sleep(1)
                else:
                    raise RuntimeError("No capacity after 25 retries")
                async with connect(socket_url(args.url, response.json()), origin=args.url,
                                   proxy=None, max_size=2**20, open_timeout=10) as ws:
                    welcome = json.loads(await asyncio.wait_for(ws.recv(), 10))
                    if welcome.get("type") != "welcome" or welcome.get("mode") != mode:
                        raise RuntimeError("Missing welcome or wrong mode")
                    initial = json.loads(await asyncio.wait_for(ws.recv(), 10))
                    session = {"mode": mode, "matchId": initial["matchId"],
                               "joinMs": round((time.monotonic()-began)*1000, 2), "snapshots": 0,
                               "rttMs": [], "maxHumans": initial["humans"]}
                    sessions[index] = session
                    active += 1
                    peak = max(peak, active)
                    if active == args.players:
                        joined.set()

                    async def receive():
                        async for raw in ws:
                            data = json.loads(raw)
                            if data["type"] == "snapshot":
                                if data["matchId"] != session["matchId"] or data["mode"] != mode or data["humans"] > 10:
                                    raise RuntimeError("Room isolation or capacity violation")
                                session["snapshots"] += 1
                                session["maxHumans"] = max(session["maxHumans"], data["humans"])
                            elif data["type"] == "pong":
                                session["rttMs"].append(round((time.monotonic()-data["timestamp"])*1000, 3))
                            elif data["type"] == "error":
                                raise RuntimeError(data["message"])
                        raise RuntimeError("Socket closed during probe")

                    reader = asyncio.create_task(receive())
                    try:
                        # All connections overlap for the requested duration.
                        deadline = start + args.players/args.rate + args.seconds + 45
                        sequence = 0
                        while time.monotonic() < deadline:
                            if joined.is_set():
                                deadline = min(deadline, shared_end[0])
                            if reader.done():
                                reader.result()
                            await ws.send(json.dumps({"type": "input", "seq": sequence,
                                "moveX": .3, "moveZ": .6, "yaw": 0, "pitch": 0,
                                "fire": sequence % 60 == 0, "power": .6,
                                "jumpPower": .6 if sequence % 40 == 0 else None}))
                            if sequence % 20 == 0:
                                await ws.send(json.dumps({"type": "ping", "timestamp": time.monotonic()}))
                            sequence += 1
                            await asyncio.sleep(.05)
                    finally:
                        reader.cancel()
                        await asyncio.gather(reader, return_exceptions=True)
                        active -= 1
            except Exception as error:
                errors.append({"player": index, "error": type(error).__name__, "detail": str(error)[:150]})

        shared_end = [float("inf")]

        async def sampler():
            while not finished.is_set():
                if joined.is_set() and math.isinf(shared_end[0]):
                    shared_end[0] = time.monotonic() + args.seconds
                samples.append({"seconds": round(time.monotonic()-start, 2), "active": active})
                await asyncio.sleep(1)

        finished = asyncio.Event()
        sample_task = asyncio.create_task(sampler())
        await asyncio.gather(*(player(index) for index in range(args.players)))
        finished.set()
        await sample_task
    modes = {mode: len({s["matchId"] for s in sessions.values() if s["mode"] == mode})
             for mode in ("race", "eliminations")}
    rtts = sorted(value for session in sessions.values() for value in session["rttMs"])
    result = {"utc": datetime.now(timezone.utc).isoformat(), "url": args.url, "scope": "short_multi_room_probe",
              "requested": args.players, "joined": len(sessions), "peakCCU": peak, "secondsAtPeakRequested": args.seconds,
              "roomsByMode": modes, "errors": errors, "rttP95Ms": rtts[math.ceil(len(rtts)*.95)-1] if rtts else None,
              "samples": samples, "sessions": list(sessions.values())}
    Path(args.output).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k not in ("sessions", "samples")}, indent=2))
    return 0 if peak == args.players and not errors else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--players", type=int, default=40)
    parser.add_argument("--rate", type=float, default=4)
    parser.add_argument("--seconds", type=int, default=20)
    parser.add_argument("--output", default="evidence/aws-multi-room.json")
    args = parser.parse_args()
    if not 1 <= args.players <= 100 or args.rate <= 0 or not 1 <= args.seconds <= 120:
        parser.error("This short probe supports 1..100 players and 1..120 seconds.")
    args.url = args.url.rstrip("/")
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
