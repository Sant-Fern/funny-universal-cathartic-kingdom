"""Render Kubernetes JSON from explicit ECR image references (no deployment side effects)."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--registry", required=True)
parser.add_argument("--tag", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--results-function", default="pogo-leaderboard")
parser.add_argument("--leaderboard-url", default="")
args = parser.parse_args()
items = []


def add(kind, name, spec=None, api="v1", **fields):
    item = {"apiVersion": api, "kind": kind, "metadata": {"name": name, "namespace": "pogo"}, **fields}
    if spec is not None:
        item["spec"] = spec
    items.append(item)
    return item


add("Namespace", "pogo")["metadata"].pop("namespace")
add("ServiceAccount", "gateway")
add("Role", "gateway", api="rbac.authorization.k8s.io/v1", rules=[
    {"apiGroups": ["agones.dev"], "resources": ["gameservers"], "verbs": ["get", "list"]},
    {"apiGroups": ["allocation.agones.dev"], "resources": ["gameserverallocations"], "verbs": ["create"]},
    {"apiGroups": [""], "resources": ["pods"], "verbs": ["get"]},
])
add("RoleBinding", "gateway", api="rbac.authorization.k8s.io/v1",
    roleRef={"apiGroup": "rbac.authorization.k8s.io", "kind": "Role", "name": "gateway"},
    subjects=[{"kind": "ServiceAccount", "name": "gateway", "namespace": "pogo"}])

for mode in ("eliminations", "race"):
    add("Fleet", f"pogo-{mode}", api="agones.dev/v1", spec={
        "replicas": 2, "scheduling": "Packed",
        "strategy": {"type": "RollingUpdate", "rollingUpdate": {"maxSurge": "25%", "maxUnavailable": "25%"}},
        "template": {"metadata": {"labels": {"app": "pogo-game", "mode": mode}}, "spec": {
            "container": "game", "ports": [{"name": "web", "portPolicy": "None", "containerPort": 8000, "protocol": "TCP"}],
            "health": {"initialDelaySeconds": 30, "periodSeconds": 5, "failureThreshold": 3},
            "counters": {"players": {"count": 0, "capacity": 10}},
            "template": {"metadata": {"labels": {"app": "pogo-game", "mode": mode}}, "spec": {
                "terminationGracePeriodSeconds": 30,
                "containers": [{"name": "game", "image": f"{args.registry}/pogo/server:{args.tag}",
                                "env": [{"name": "MATCH_MODE", "value": mode},
                                        {"name": "RESULTS_FUNCTION", "value": args.results_function},
                                        {"name": "AWS_DEFAULT_REGION", "value": "us-east-2"}],
                                "ports": [{"name": "http", "containerPort": 8000}],
                                "resources": {"requests": {"cpu": "100m", "memory": "128Mi"}, "limits": {"cpu": "1", "memory": "384Mi"}},
                                "readinessProbe": {"httpGet": {"path": "/health", "port": 8000}, "initialDelaySeconds": 3},
                                "securityContext": {"allowPrivilegeEscalation": False, "capabilities": {"drop": ["ALL"]}}}]
            }}
        }}
    })
    add("FleetAutoscaler", f"pogo-{mode}", api="autoscaling.agones.dev/v1", spec={
        "fleetName": f"pogo-{mode}", "policy": {"type": "Buffer", "buffer": {"bufferSize": 2, "minReplicas": 2, "maxReplicas": 110}}
    })

for name, image, cpu, memory, port in (("gateway", "gateway", "400m", "128Mi", 8000), ("client", "client", "50m", "32Mi", 80)):
    pod = {"containers": [{"name": name, "image": f"{args.registry}/pogo/{image}:{args.tag}",
                           "ports": [{"name": "http", "containerPort": port}],
                           "resources": {"requests": {"cpu": cpu, "memory": memory}, "limits": {"cpu": "1", "memory": "512Mi"}},
                           "readinessProbe": {"httpGet": {"path": "/health" if name == "gateway" else "/", "port": port}, "initialDelaySeconds": 3}}]}
    if name == "gateway":
        pod["topologySpreadConstraints"] = [{"maxSkew": 1, "topologyKey": "kubernetes.io/hostname",
            "whenUnsatisfiable": "ScheduleAnyway", "labelSelector": {"matchLabels": {"app": "gateway"}}}]
        pod["serviceAccountName"] = "gateway"
        pod["containers"][0]["env"] = [{"name": "POD_NAMESPACE", "value": "pogo"},
                                       {"name": "LEADERBOARD_URL", "value": args.leaderboard_url}]
    add("Deployment", name, api="apps/v1", spec={"replicas": 2, "selector": {"matchLabels": {"app": name}},
        "template": {"metadata": {"labels": {"app": name}}, "spec": pod}})
    add("Service", "server" if name == "gateway" else name, spec={"selector": {"app": name}, "ports": [{"name": "http", "port": port, "targetPort": "http"}]})
add("HorizontalPodAutoscaler", "gateway", api="autoscaling/v2", spec={
    "scaleTargetRef": {"apiVersion": "apps/v1", "kind": "Deployment", "name": "gateway"},
    "minReplicas": 2, "maxReplicas": 6,
    "metrics": [{"type": "Resource", "resource": {"name": "cpu", "target": {"type": "Utilization", "averageUtilization": 60}}}],
    "behavior": {"scaleDown": {"stabilizationWindowSeconds": 180}}
})
ingress = add("Ingress", "pogo", api="networking.k8s.io/v1", spec={"ingressClassName": "alb", "rules": [{"http": {"paths": [
    {"path": "/", "pathType": "Prefix", "backend": {"service": {"name": "client", "port": {"number": 80}}}}
]}}]})
ingress["metadata"]["annotations"] = {
    "alb.ingress.kubernetes.io/scheme": "internet-facing", "alb.ingress.kubernetes.io/target-type": "ip",
    "alb.ingress.kubernetes.io/load-balancer-name": "pogo-demo-web",
    "alb.ingress.kubernetes.io/tags": "Project=pogo-arena,ManagedBy=Kubernetes",
    "alb.ingress.kubernetes.io/load-balancer-attributes": "idle_timeout.timeout_seconds=120",
    "alb.ingress.kubernetes.io/healthcheck-path": "/"
}
add("PodMonitor", "pogo", api="monitoring.coreos.com/v1", spec={
    "selector": {"matchLabels": {"app": "pogo-game"}},
    "podMetricsEndpoints": [{"port": "http", "path": "/metrics", "interval": "15s"}]
})
add("PodMonitor", "gateway", api="monitoring.coreos.com/v1", spec={
    "selector": {"matchLabels": {"app": "gateway"}},
    "podMetricsEndpoints": [{"port": "http", "path": "/metrics", "interval": "15s"}]
})
Path(args.output).write_text(json.dumps({"apiVersion": "v1", "kind": "List", "items": items}, indent=2), encoding="utf-8")
