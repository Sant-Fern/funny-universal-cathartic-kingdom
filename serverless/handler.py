"""IAM-only result ingestion and public best-match leaderboard reads."""
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
import re
import time
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config

TABLE_NAME = os.environ.get("RESULTS_TABLE", "pogo-results")
_table = boto3.resource("dynamodb", config=Config(
    retries={"total_max_attempts": 3, "mode": "standard"},
    connect_timeout=2, read_timeout=4)).Table(TABLE_NAME)
MODES = ("race", "eliminations")


def clean_result(event):
    match_id = str(uuid.UUID(event["matchId"]))
    mode = event["mode"]
    if mode not in MODES:
        raise ValueError("Modo inválido")
    players = event["players"]
    if not isinstance(players, list) or not 1 <= len(players) <= 10:
        raise ValueError("Se requieren entre uno y diez resultados humanos")
    cleaned, slots = [], set()
    for player in players:
        slot, name = player["id"], player["name"]
        if not re.fullmatch(r"slot-[0-9]", slot) or slot in slots:
            raise ValueError("Puesto duplicado o inválido")
        slots.add(slot)
        if not isinstance(name, str) or not re.fullmatch(r"[\w .\-]{1,16}", name):
            raise ValueError("Apodo inválido")
        score = player["score"]
        if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 10000:
            raise ValueError("Puntuación inválida")
        cleaned.append({"id": slot, "name": name, "score": score})
    return {"matchId": match_id, "mode": mode, "test": event.get("test") is True,
            "players": sorted(cleaned, key=lambda player: player["id"])}


def submit(event):
    data = clean_result(event)
    digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    marker = {"pk": f"MATCH#{data['matchId']}", "sk": "RESULT"}
    now = int(time.time())
    board = f"BOARD#{data['mode']}" + ("#TEST" if data["test"] else "")
    # Atomic marker + rows: a retry cannot duplicate or partially change a match.
    # The low-level transaction API needs literal conditions; native values are
    # serialized by DynamoDB resource.meta.client's registered handlers.
    items = [{"Put": {"TableName": TABLE_NAME, "Item": {
        **marker, "digest": digest, "createdAt": now, "expiresAt": now+365*86400},
        "ConditionExpression": "attribute_not_exists(pk)"}}]
    for player in data["players"]:
        items.append({"Put": {"TableName": TABLE_NAME, "Item": {
            "pk": board, "sk": f"SCORE#{player['score']:06d}#{data['matchId']}#{player['id']}",
            "name": player["name"], "score": player["score"], "matchId": data["matchId"],
            "createdAt": now, "expiresAt": now+30*86400}}})
    try:
        _table.meta.client.transact_write_items(TransactItems=items)
    except _table.meta.client.exceptions.TransactionCanceledException:
        existing = _table.get_item(Key=marker, ConsistentRead=True).get("Item")
        if existing and existing["digest"] == digest:
            return {"status": "duplicate", "matchId": data["matchId"]}
        if existing:
            raise ValueError("El resultado de esta partida ya se guardó con otros datos")
        raise
    return {"status": "saved", "matchId": data["matchId"], "players": len(data["players"])}


def leaderboard(mode, test=False):
    if mode not in MODES:
        raise ValueError("Modo inválido")
    board = f"BOARD#{mode}" + ("#TEST" if test else "")
    response = _table.query(KeyConditionExpression=Key("pk").eq(board),
                             ScanIndexForward=False, Limit=20)
    rows = [{key: row[key] for key in ("name", "score", "matchId", "createdAt")}
            for row in response.get("Items", [])]
    return {"mode": mode, "ranking": "best_match_scores", "items": rows,
            "retentionDays": 30, "generatedAt": datetime.now(timezone.utc).isoformat()}


def handler(event, context):
    try:
        http = event.get("requestContext", {}).get("http")
        if http is not None:
            # API Gateway exposes only GET. A browser cannot invoke submit by
            # putting action=submit in a body or query string.
            if http.get("method") != "GET":
                return {"statusCode": 405, "body": '{"error":"Solo lectura"}'}
            query = event.get("queryStringParameters") or {}
            body = leaderboard(query.get("mode", "eliminations"), query.get("test") == "1")
            return {"statusCode": 200, "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
                    "body": json.dumps(body, default=lambda value: int(value) if isinstance(value, Decimal) else str(value))}
        if event.get("action") != "submit":
            raise ValueError("Acción inválida")
        return submit(event)
    except (ValueError, KeyError, TypeError) as error:
        if "requestContext" in event:
            return {"statusCode": 400, "body": json.dumps({"error": str(error)})}
        return {"status": "invalid", "error": str(error)}
