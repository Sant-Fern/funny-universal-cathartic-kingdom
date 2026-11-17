"""Export original Prometheus query responses for a specific load run."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import urlopen

QUERIES = {
    "ccu": "sum(pogo_ccu)",
    "active_tick_p99_ms": "1000*histogram_quantile(0.99,sum by(le)(rate(pogo_tick_seconds_bucket[2m])))",
    "gameservers": "sum by(type)(agones_gameservers_count)",
    "nodes": 'sum(kube_node_status_condition{condition="Ready",status="true"})',
    "gateway_replicas": 'kube_deployment_status_replicas{namespace="pogo",deployment="gateway"}',
    "pending_pods": 'sum(kube_pod_status_phase{namespace="pogo",phase="Pending"})',
    "game_cpu_cores": 'sum(rate(container_cpu_usage_seconds_total{namespace="pogo",container="game"}[1m]))',
    "gateway_cpu_cores": 'sum(rate(container_cpu_usage_seconds_total{namespace="pogo",container="gateway"}[1m]))',
    "results_saved": "sum(pogo_results_saved_total)",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    args = parser.parse_args()
    directory = Path("evidence/aws-load") / args.label
    record = json.loads((directory / "commands.json").read_text(encoding="utf-8-sig"))
    start = datetime.fromisoformat(record["started_utc"]).timestamp()-30
    end = time.time()
    result = {"utc": datetime.now(timezone.utc).isoformat(), "start_epoch": start, "end_epoch": end,
              "step_seconds": 15, "queries": {}}
    for name, query in QUERIES.items():
        params = urlencode({"query": query, "start": start, "end": end, "step": 15})
        with urlopen("http://127.0.0.1:9090/api/v1/query_range?"+params, timeout=20) as response:
            result["queries"][name] = {"query": query, "response": json.load(response)}
    (directory / "prometheus.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("Saved", directory / "prometheus.json")


if __name__ == "__main__":
    main()
