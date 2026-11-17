"""Generate a portable Grafana dashboard and its Kubernetes provisioner."""
import json
from pathlib import Path

queries = [
    ("Jugadores humanos conectados", "sum(pogo_ccu)", "short", "stat"),
    ("Trabajo del tick p99 (ms)", "1000 * histogram_quantile(0.99, sum by (le) (rate(pogo_tick_seconds_bucket[2m])))", "ms", "timeseries"),
    ("GameServers por estado", "sum by (type) (agones_gameservers_count)", "short", "timeseries"),
    ("Nodos listos", 'sum(kube_node_status_condition{condition="Ready",status="true"})', "short", "timeseries"),
    ("CCU por modo", "sum by (mode) (pogo_ccu)", "short", "timeseries"),
    ("Réplicas del gateway", 'kube_deployment_status_replicas{namespace="pogo",deployment="gateway"}', "short", "timeseries"),
    ("CPU del juego (núcleos)", 'sum(rate(container_cpu_usage_seconds_total{namespace="pogo",container="game"}[2m]))', "short", "timeseries"),
    ("Snapshots descartados por cliente lento", "sum(rate(pogo_snapshot_dropped_total[2m]))", "ops", "timeseries"),
]
panels = []
for index, (title, query, unit, kind) in enumerate(queries):
    panels.append({"id": index+1, "title": title, "type": kind,
                   "gridPos": {"x": (index % 2)*12, "y": (index//2)*8, "w": 12, "h": 8},
                   "datasource": {"type": "prometheus", "uid": "prometheus"},
                   "targets": [{"expr": query, "refId": "A", "legendFormat": "{{mode}}{{type}}"}],
                   "fieldConfig": {"defaults": {"unit": unit}, "overrides": []}})
dashboard = {"uid": "pogo-integrador", "title": "Pogo · Integrador AWS", "schemaVersion": 39,
             "version": 1, "refresh": "10s", "time": {"from": "now-30m", "to": "now"},
             "tags": ["pogo", "integrador"], "panels": panels}
root = Path(__file__).resolve().parents[1]
(root / "k8s/aws/dashboard.json").write_text(json.dumps(dashboard, indent=2), encoding="utf-8")
configmap = {"apiVersion": "v1", "kind": "ConfigMap", "metadata": {"name": "pogo-dashboard", "namespace": "monitoring",
             "labels": {"grafana_dashboard": "1"}}, "data": {"pogo.json": json.dumps(dashboard)}}
(root / "k8s/aws/dashboard-configmap.json").write_text(json.dumps(configmap, indent=2), encoding="utf-8")
