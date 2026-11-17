import json
import uuid

import boto3
from moto import mock_aws
import pytest

from serverless import handler as module
from server.game import Arena
from server.results import payload


@pytest.fixture
def store(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-2")
    with mock_aws():
        resource = boto3.resource("dynamodb", region_name="us-east-2")
        table = resource.create_table(TableName="pogo-results", BillingMode="PAY_PER_REQUEST",
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
            AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}, {"AttributeName": "sk", "AttributeType": "S"}])
        monkeypatch.setattr(module, "_table", table)
        yield table


def result(**changes):
    return {"action": "submit", "matchId": str(uuid.uuid4()), "mode": "race",
            "players": [{"id": "slot-0", "name": "Ana", "score": 10},
                        {"id": "slot-1", "name": "Luis", "score": 7}], **changes}


def test_atomic_submission_is_idempotent_and_rejects_changed_match(store):
    event = result()
    assert module.handler(event, None)["status"] == "saved"
    assert module.handler(event, None)["status"] == "duplicate"
    assert store.scan()["Count"] == 3
    event["players"][0]["score"] = 1
    assert module.handler(event, None)["status"] == "invalid"
    assert store.scan()["Count"] == 3
    assert [row["score"] for row in module.leaderboard("race")["items"]] == [10, 7]


def test_public_reader_cannot_submit_and_test_scores_are_separate(store):
    event = result(test=True)
    assert module.handler(event, None)["status"] == "saved"
    assert not module.leaderboard("race")["items"]
    assert len(module.leaderboard("race", True)["items"]) == 2
    event["requestContext"] = {"http": {"method": "POST"}}
    assert module.handler(event, None)["statusCode"] == 405
    read = {"requestContext": {"http": {"method": "GET"}}, "queryStringParameters": {"mode": "race", "test": "1"}}
    response = module.handler(read, None)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["items"][0]["score"] == 10


def test_invalid_payload_writes_nothing_and_bots_are_not_ranked(store):
    assert module.handler(result(players=[{"id": "slot-0", "name": "Bad", "score": -1}]), None)["status"] == "invalid"
    assert store.scan()["Count"] == 0
    arena = Arena(mode="eliminations")
    human = arena.join("Ana")
    human.balloons = 0b11
    human.pops = 4
    report = payload(arena)
    assert report["players"] == [{"id": human.id, "name": "Ana", "score": 204}]
