import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from server.app import create_app


def read_until(ws, kind):
    for _ in range(50):
        data = ws.receive_json()
        if data["type"] == kind:
            return data
    raise AssertionError(f"Missing {kind}")


def test_two_clients_share_match_and_ping_and_reject_token_reuse():
    with TestClient(create_app()) as client:
        token = client.post("/api/join", json={"name": "Uno"}).json()["token"]
        with client.websocket_connect(f"/ws?token={token}") as one:
            welcome = one.receive_json()
            assert welcome["type"] == "welcome"
            snap = read_until(one, "snapshot")
            assert snap["humans"] == 1 and snap["bots"] == 9
            with pytest.raises(WebSocketDisconnect):
                with client.websocket_connect(f"/ws?token={token}"):
                    pass
            token2 = client.post("/api/join", json={"name": "Dos"}).json()["token"]
            with client.websocket_connect(f"/ws?token={token2}") as two:
                second = two.receive_json()
                assert second["team"] is welcome["team"] is None
                shared = read_until(two, "snapshot")
                assert shared["matchId"] == snap["matchId"]
                assert shared["humans"] == 2 and shared["bots"] == 8
                one.send_json({"type": "ping", "timestamp": 123})
                assert read_until(one, "pong")["timestamp"] == 123
                one.send_json({"type": "input", "seq": 0, "moveX": 100, "moveZ": 0,
                               "yaw": 0, "pitch": 0, "fire": False, "jumpPower": None})
                assert read_until(one, "error")["message"]


def test_join_validation_invalid_origin_and_invalid_token():
    with TestClient(create_app()) as client:
        assert client.post("/api/join", json={"name": " "}).status_code == 422
        assert client.post("/api/join", json={"name": "<script>"}).status_code == 422
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws?token=wrong"):
                pass
        token = client.post("/api/join", json={"name": "Prueba"}).json()["token"]
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws?token={token}", headers={"Origin": "https://other.example"}):
                pass


def test_reservations_count_toward_capacity():
    with TestClient(create_app()) as client:
        for _ in range(10):
            assert client.post("/api/join", json={"name": "Prueba"}).status_code == 200
        assert client.post("/api/join", json={"name": "Once"}).status_code == 409


def test_local_modes_have_separate_matches():
    with TestClient(create_app()) as client:
        classic = client.post("/api/join", json={"name": "Uno"}).json()
        zone = client.post("/api/join", json={"name": "Dos", "mode": "race"}).json()
        with client.websocket_connect(f"/ws?token={classic['token']}") as one:
            with client.websocket_connect(f"/ws?token={zone['token']}") as two:
                assert read_until(one, "welcome")["mode"] == "eliminations"
                assert read_until(two, "welcome")["mode"] == "race"
                one_state, two_state = read_until(one, "snapshot"), read_until(two, "snapshot")
                assert one_state["matchId"] != two_state["matchId"]
                assert one_state["humans"] == two_state["humans"] == 1
                assert all(p["balloonCount"] == 3 and p["team"] is None for p in one_state["players"])
                assert all(p["balloonCount"] is None and p["team"] in (0, 1) for p in two_state["players"])
