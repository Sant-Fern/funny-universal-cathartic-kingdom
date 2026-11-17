"""Send trusted, finished-match scores without blocking the simulation tick."""
import asyncio
from datetime import datetime, timezone
import json
import logging
import os

import boto3
from botocore.config import Config

log = logging.getLogger("pogo.results")


def payload(arena):
    players = []
    for player in arena.players.values():
        if player.bot:
            continue
        score = player.race_points if arena.mode == "race" else player.balloons.bit_count()*100+player.pops
        players.append({"id": player.id, "name": player.name, "score": int(score)})
    return {"action": "submit", "matchId": arena.id, "mode": arena.mode, "players": players,
            "endedAt": datetime.now(timezone.utc).isoformat(),
            "test": os.environ.get("RESULTS_TEST") == "1" or any(p["name"].startswith(("LT-", "QA-")) for p in players)}


def invoke(client, function_name, result):
    response = client.invoke(FunctionName=function_name, InvocationType="RequestResponse",
                             Payload=json.dumps(result).encode())
    body = json.load(response["Payload"])
    if response.get("FunctionError") or body.get("status") not in ("saved", "duplicate"):
        raise RuntimeError("No se pudo guardar el resultado")
    return body


async def worker(runtime):
    function = os.environ.get("RESULTS_FUNCTION")
    if not function:
        return
    client = await asyncio.to_thread(boto3.client, "lambda", config=Config(
        retries={"total_max_attempts": 3, "mode": "standard"}, connect_timeout=2, read_timeout=8))
    while True:
        result = await runtime.results_queue.get()
        try:
            for attempt in range(8):
                try:
                    await asyncio.to_thread(invoke, client, function, result)
                    runtime.results_saved += 1
                    break
                except Exception as error:
                    runtime.results_failures += 1
                    log.warning("Result save failed (%s), attempt %d", type(error).__name__, attempt+1)
                    if attempt == 7:
                        log.error("Result save exhausted retries for %s", result["matchId"])
                    else:
                        await asyncio.sleep(min(2**attempt, 15))
        finally:
            runtime.results_pending -= 1
            runtime.results_queue.task_done()
