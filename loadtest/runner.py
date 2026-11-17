"""Run two Locust workers per dedicated EC2 generator and export raw artifacts."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

import boto3
ARTIFACTS_BUCKET = os.environ.get("ARTIFACTS_BUCKET", "pogo-artifacts-933605931561-us-east-2")


def upload(output, bucket, label, generator):
    s3 = boto3.client("s3")
    for path in output.iterdir():
        if path.is_file():
            s3.put_object(Bucket=ARTIFACTS_BUCKET, Key=f"runs/{label}/{generator}/{path.name}",
                          Body=path.read_bytes(), ServerSideEncryption="AES256")


def main():
    global ARTIFACTS_BUCKET
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--users", type=int, default=1000)
    parser.add_argument("--rate", type=float, default=2)
    parser.add_argument("--duration", type=int, default=1200)
    parser.add_argument("--class-name", default="PogoUser")
    parser.add_argument("--master-host", default="127.0.0.1")
    parser.add_argument("--worker-only", action="store_true")
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--generator", required=True)
    args = parser.parse_args()
    ARTIFACTS_BUCKET = args.bucket
    output = Path("/output")
    output.mkdir(parents=True, exist_ok=True)
    os.environ["LOAD_OUTPUT"] = str(output)
    processes, files = [], []
    start = time.time()
    base = [sys.executable, "-m", "locust", "-f", "loadtest/locustfile.py", args.class_name]
    try:
        if not args.worker_only:
            log = (output / "master.log").open("w")
            files.append(log)
            master = subprocess.Popen([*base, "--master", "--expect-workers", "4", "--expect-workers-max-wait", "120",
                "--headless", "--host", args.host, "-u", str(args.users), "-r", str(args.rate),
                "-t", str(args.duration), "--stop-timeout", "10", "--exit-code-on-error", "0",
                "--csv", str(output/args.label), "--csv-full-history", "--html", str(output/(args.label+".html"))], stdout=log, stderr=subprocess.STDOUT)
            processes.append(master)
        for number in range(2):
            log = (output / f"worker-{number}.log").open("w")
            files.append(log)
            processes.append(subprocess.Popen([*base, "--worker", "--master-host", args.master_host,
                "--host", args.host], stdout=log, stderr=subprocess.STDOUT))
        if args.worker_only:
            for process in processes:
                process.wait(timeout=args.duration+240)
        else:
            master.wait(timeout=args.duration+240)
    finally:
        for process in processes:
            if process.poll() is None:
                process.send_signal(signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
        for stream in files:
            stream.close()
        (output / "run.json").write_text(json.dumps({"label": args.label, "host": args.host,
            "class": args.class_name, "requested_users": args.users, "spawn_rate": args.rate,
            "duration_requested_seconds": args.duration, "started_epoch": start,
            "ended_epoch": time.time(), "generator": args.generator, "worker_only": args.worker_only,
            "process_exit_codes": [process.returncode for process in processes]}, indent=2))
        upload(output, args.bucket, args.label, args.generator)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
