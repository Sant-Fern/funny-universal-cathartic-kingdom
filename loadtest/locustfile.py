"""Real WebSocket players, paced HLS viewers and an 80/20 leaderboard workload."""
import csv
import json
import os
from pathlib import Path
import random
import time
from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit
import uuid

import boto3
from botocore.config import Config
import gevent
from locust import HttpUser, User, between, constant, events, task
from locust.runners import WorkerRunner
import websocket

STATS = {"connected": 0, "viewers": 0, "inputs": 0, "snapshots": 0, "bytes": 0, "reconnections": 0}
WORKERS = {}


@events.report_to_master.add_listener
def report_to_master(client_id, data, **kwargs):
    data["pogo"] = dict(STATS)


@events.worker_report.add_listener
def worker_report(client_id, data, **kwargs):
    WORKERS[client_id] = data.get("pogo", {})


@events.init.add_listener
def init(environment, **kwargs):
    def record():
        output = Path(os.environ.get("LOAD_OUTPUT", "/output"))
        output.mkdir(parents=True, exist_ok=True)
        with (output / "pogo-timeseries.csv").open("w", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=["utc_epoch", "locust_users", "max_worker_cpu", *STATS])
            writer.writeheader()
            while environment.runner:
                values = {key: sum(worker.get(key, 0) for worker in WORKERS.values()) for key in STATS} if WORKERS else dict(STATS)
                clients = getattr(environment.runner, "clients", {})
                cpus = [worker.cpu_usage for worker in clients.values()] if hasattr(clients, "values") else []
                writer.writerow({"utc_epoch": time.time(), "locust_users": environment.runner.user_count,
                                 "max_worker_cpu": max(cpus, default=environment.runner.current_cpu_usage), **values})
                stream.flush()
                gevent.sleep(2)
    if not isinstance(environment.runner, WorkerRunner):
        gevent.spawn(record)


class PogoUser(HttpUser):
    wait_time = constant(.05)

    def on_start(self):
        self.socket = self.reader = None
        self.finished = self.failed = False
        self.sequence = 0
        self.name = "LT-" + uuid.uuid4().hex[:10]
        self.mode = os.environ.get("LOAD_MODE", "eliminations")
        self.last_frame = time.monotonic()
        self.retry_delay = 1

    def disconnect(self):
        if self.reader:
            self.reader.kill(block=False)
            self.reader = None
        if self.socket:
            STATS["connected"] -= 1
            self.socket.close(timeout=.1)
            self.socket = None

    def connect(self):
        self.failed = self.finished = False
        started = time.perf_counter()
        with self.client.post("/api/join", json={"name": self.name, "mode": self.mode},
                              name="join", timeout=12, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"join HTTP {response.status_code}")
                gevent.sleep(self.retry_delay+random.random())
                self.retry_delay = min(15, self.retry_delay*1.5)
                return
            reservation = response.json()
        base = urlsplit(self.host)
        target = urlsplit(urljoin(self.host, reservation["websocketPath"]))
        if target.netloc != base.netloc:
            raise RuntimeError("Unexpected WebSocket destination")
        url = urlunsplit(("wss" if base.scheme == "https" else "ws", target.netloc,
                          target.path, urlencode({"token": reservation["token"]}), ""))
        try:
            connection = websocket.create_connection(url, origin=self.host, timeout=12,
                enable_multithread=False, skip_utf8_validation=True)
            welcome = json.loads(connection.recv())
            if welcome.get("type") != "welcome" or welcome.get("mode") != self.mode:
                connection.close()
                raise RuntimeError("Wrong room or missing welcome")
            self.socket = connection
            STATS["connected"] += 1
            self.sequence = 0
            self.last_frame = time.monotonic()
            self.retry_delay = 1
            self.environment.events.request.fire(request_type="WS", name="join_to_welcome",
                response_time=(time.perf_counter()-started)*1000, response_length=0, exception=None)
            self.reader = gevent.spawn(self.receive)
        except Exception as error:
            self.environment.events.request.fire(request_type="WS", name="connect",
                response_time=(time.perf_counter()-started)*1000, response_length=0, exception=error)
            gevent.sleep(self.retry_delay+random.random())
            self.retry_delay = min(15, self.retry_delay*1.5)

    def receive(self):
        try:
            while self.socket:
                raw = self.socket.recv()
                if not raw:
                    raise RuntimeError("WebSocket closed")
                self.last_frame = time.monotonic()
                STATS["bytes"] += len(raw.encode("utf-8"))
                # Avoid JSON-decoding every snapshot: the generator must not
                # become a graphics/physics client bottleneck.
                if '"type":"snapshot"' in raw:
                    STATS["snapshots"] += 1
                    if '"status":"finished"' in raw:
                        self.finished = True
                elif '"type":"pong"' in raw:
                    data = json.loads(raw)
                    self.environment.events.request.fire(request_type="WS", name="ping_rtt",
                        response_time=(time.monotonic()-data["timestamp"])*1000,
                        response_length=len(raw), exception=None)
                elif '"type":"error"' in raw:
                    raise RuntimeError("Server rejected control")
        except Exception as error:
            if self.socket and not self.finished:
                self.environment.events.request.fire(request_type="WS", name="receive",
                    response_time=0, response_length=0, exception=error)
            self.failed = True

    @task
    def play(self):
        if not self.socket or self.finished or self.failed or time.monotonic()-self.last_frame > 10:
            self.disconnect()
            STATS["reconnections"] += 1
            self.connect()
            return
        try:
            sequence = self.sequence
            self.socket.send(json.dumps({"type": "input", "seq": sequence,
                "moveX": .4, "moveZ": .6, "yaw": (sequence*.005)%6.28,
                "pitch": .1, "fire": sequence%60 == 0, "power": .65,
                "jumpPower": .65 if sequence%40 == 0 else None}))
            STATS["inputs"] += 1
            if sequence%20 == 0:
                self.socket.send(json.dumps({"type": "ping", "timestamp": time.monotonic()}))
            self.sequence += 1
        except Exception as error:
            self.failed = True
            self.environment.events.request.fire(request_type="WS", name="send",
                response_time=0, response_length=0, exception=error)

    def on_stop(self):
        self.disconnect()


class SpectatorUser(HttpUser):
    wait_time = constant(0)

    def on_start(self):
        self.segments = []
        self.position = 0
        self.buffer = 4.0
        self.last_fetch = time.monotonic()
        with self.client.get("/hls/stream.m3u8", name="hls_playlist", catch_response=True) as response:
            if response.status_code == 200:
                self.segments = [line.strip() for line in response.text.splitlines() if line and not line.startswith("#")]
            if not self.segments:
                response.failure("No HLS segments")
            else:
                STATS["viewers"] += 1

    def on_stop(self):
        if self.segments:
            STATS["viewers"] -= 1

    @task
    def watch(self):
        if not self.segments:
            gevent.sleep(1)
            return
        start = time.perf_counter()
        segment = self.segments[self.position%len(self.segments)]
        with self.client.get("/hls/"+segment, name="hls_segment", catch_response=True) as response:
            completed = time.monotonic()
            underrun = max(0, completed-self.last_fetch-self.buffer)
            self.buffer = max(0, self.buffer-(completed-self.last_fetch))
            self.last_fetch = completed
            if response.status_code == 200:
                self.buffer += 4
                STATS["bytes"] += len(response.content)
                self.environment.events.request.fire(request_type="HLS", name="buffer_seconds",
                    response_time=max(0, self.buffer)*1000, response_length=0, exception=None)
            else:
                response.failure(f"HLS HTTP {response.status_code}")
        if underrun > 0:
            self.environment.events.request.fire(request_type="HLS", name="rebuffer",
                response_time=underrun*1000, response_length=0, exception=RuntimeError("Playback buffer empty"))
        self.position += 1
        gevent.sleep(max(0, 4-(time.perf_counter()-start)))


class LeaderboardUser(HttpUser):
    wait_time = between(8, 12)
    _lambda = None

    def on_start(self):
        # Browser sessions do not all refresh their first leaderboard in the
        # same scheduler batch. Keep the initial ramp below the account burst.
        gevent.sleep(random.uniform(0, 12))

    @task(4)
    def read(self):
        self.client.get("/leaderboard?mode=eliminations&test=1", name="leaderboard_read", timeout=10)

    @task(1)
    def write(self):
        if LeaderboardUser._lambda is None:
            LeaderboardUser._lambda = boto3.client("lambda", config=Config(
                retries={"total_max_attempts": 2, "mode": "standard"}, connect_timeout=2, read_timeout=10))
        started = time.perf_counter()
        error = None
        try:
            response = LeaderboardUser._lambda.invoke(FunctionName="pogo-leaderboard", InvocationType="RequestResponse",
                Payload=json.dumps({"action": "submit", "matchId": str(uuid.uuid4()), "mode": "eliminations", "test": True,
                    "players": [{"id": "slot-0", "name": "LT-board", "score": random.randint(0, 300)}]}).encode())
            data = json.load(response["Payload"])
            if response.get("FunctionError") or data.get("status") != "saved":
                raise RuntimeError("Result write failed")
        except Exception as exception:
            error = exception
        self.environment.events.request.fire(request_type="Lambda", name="leaderboard_write",
            response_time=(time.perf_counter()-started)*1000, response_length=0, exception=error)
