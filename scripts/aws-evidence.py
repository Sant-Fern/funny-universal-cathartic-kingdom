"""Export raw Prometheus evidence through a localhost-only port forward."""
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import urlopen

queries = {
    "ccu": "sum(pogo_ccu)",
    "active_tick_p99_ms": "1000*histogram_quantile(0.99,sum by(le)(rate(pogo_tick_seconds_bucket[2m])))",
    "gameservers": "sum by(type)(agones_gameservers_count)",
    "nodes": 'sum(kube_node_status_condition{condition="Ready",status="true"})',
    "gateway_replicas": 'kube_deployment_status_replicas{namespace="pogo",deployment="gateway"}',
}
end = time.time()
result = {"utc": datetime.now(timezone.utc).isoformat(), "scrape_interval_seconds": 15, "queries": {}}
for name, query in queries.items():
    parameters = urlencode({"query": query, "start": end-900, "end": end, "step": 15})
    with urlopen("http://127.0.0.1:9090/api/v1/query_range?"+parameters, timeout=15) as response:
        result["queries"][name] = json.load(response)
Path("evidence/aws/prometheus.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("Saved raw Prometheus responses to evidence/aws/prometheus.json")
