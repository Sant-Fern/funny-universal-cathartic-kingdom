"""Calculate list-price baseline, not a bill or a promise of free infrastructure."""
from decimal import Decimal
import json
from pathlib import Path

root = Path("evidence/aws")
ec2 = json.loads((root / "ec2-prices.json").read_text(encoding="utf-8-sig"))
ec2 = ec2[0] if isinstance(ec2, list) else ec2
alb = json.loads((root / "alb-prices.json").read_text(encoding="utf-8-sig"))
node = Decimal(ec2["usd"])
lb = Decimal(next(item["usd"] for item in alb if item["usage"] == "USE2-LoadBalancerUsage"))
eks = Decimal("0.10")  # https://aws.amazon.com/eks/pricing/, standard support
result = {
    "currency": "USD", "basis": "list_prices_before_credits_and_free_allowances",
    "node_hour": str(node), "eks_hour": str(eks), "alb_hour": str(lb),
    "two_node_base_hour": str(node * 2 + eks + lb),
    "eight_node_base_hour": str(node * 8 + eks + lb),
    "excluded": ["EBS", "public IPv4", "LCU", "cross-AZ and internet traffic", "CloudFront", "ECR", "S3", "other projects"],
    "out_of_pocket_condition": "FREE account plan remains ACTIVE; do not upgrade to Paid",
    "warning": "Resources consume promotional credits. This baseline is not the complete cost of the environment.",
}
(root / "cost-baseline.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
