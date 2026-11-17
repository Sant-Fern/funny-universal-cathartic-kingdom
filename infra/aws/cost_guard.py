"""Read-only prerequisite for the user's USD 0 out-of-pocket deployment."""
import json
import subprocess
import sys
from decimal import Decimal

response = subprocess.run(
    ["aws", "freetier", "get-account-plan-state", "--profile", sys.argv[1],
     "--region", "us-east-1", "--output", "json", "--no-cli-pager"],
    check=True, capture_output=True, text=True,
)
plan = json.loads(response.stdout)
credits = Decimal(str(plan.get("accountPlanRemainingCredits", {}).get("amount", 0)))
allowed = (plan.get("accountPlanType") == "FREE"
           and plan.get("accountPlanStatus") == "ACTIVE"
           and credits >= Decimal("40"))
print(json.dumps({"allowed": str(allowed).lower(), "plan": plan.get("accountPlanType", ""),
                  "credit_usd": str(credits)}))
