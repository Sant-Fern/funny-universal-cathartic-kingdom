"""Read list prices and built-in ALB metrics; does not query paid Cost Explorer."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import boto3
from botocore.config import Config

parser=argparse.ArgumentParser()
parser.add_argument('--label',required=True)
args=parser.parse_args()
root=Path('evidence/aws-load')/args.label
meta=json.loads((root/'commands.json').read_text(encoding='utf-8-sig'))
run=next(json.loads(p.read_text()) for p in root.glob('*/run.json') if not json.loads(p.read_text())['worker_only'])
session=boto3.Session(profile_name='neural-chess')
config=Config(retries={'mode':'standard','total_max_attempts':3},connect_timeout=5,read_timeout=20)
cloudwatch=session.client('cloudwatch',region_name='us-east-2',config=config)
result={'utc':datetime.now(timezone.utc).isoformat(),'label':args.label,'metrics':{}}
for metric,stat in [('ProcessedBytes','Sum'),('ConsumedLCUs','Average'),('ActiveConnectionCount','Sum')]:
    response=cloudwatch.get_metric_statistics(Namespace='AWS/ApplicationELB',MetricName=metric,
        Dimensions=[{'Name':'LoadBalancer','Value':'app/pogo-demo-web/0322799cef957bc7'}],
        StartTime=datetime.fromtimestamp(run['started_epoch'],timezone.utc),
        EndTime=datetime.fromtimestamp(run['ended_epoch'],timezone.utc),Period=60,Statistics=[stat])
    result['metrics'][metric]={'statistic':stat,'datapoints':sorted(response['Datapoints'],key=lambda x:x['Timestamp'])}
for metric,stat in [('ConcurrentExecutions','Maximum'),('Throttles','Sum'),('Invocations','Sum'),('Errors','Sum'),('Duration','Average')]:
    response=cloudwatch.get_metric_statistics(Namespace='AWS/Lambda',MetricName=metric,
        Dimensions=[{'Name':'FunctionName','Value':'pogo-leaderboard'}],
        StartTime=datetime.fromtimestamp(run['started_epoch'],timezone.utc),
        EndTime=datetime.fromtimestamp(run['ended_epoch'],timezone.utc),Period=60,Statistics=[stat])
    result['metrics']['lambda_'+metric]={'statistic':stat,'datapoints':sorted(response['Datapoints'],key=lambda x:x['Timestamp'])}
(root/'cloudwatch-alb.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf-8')
pricing=session.client('pricing',region_name='us-east-1',config=config)
response=pricing.get_products(ServiceCode='AmazonEC2',Filters=[
    {'Type':'TERM_MATCH','Field':'location','Value':'US East (Ohio)'},
    {'Type':'TERM_MATCH','Field':'usagetype','Value':'USE2-EBS:VolumeUsage.gp3'}],MaxResults=100)
prices=[]
for raw in response['PriceList']:
    product=json.loads(raw)
    for term in product['terms'].get('OnDemand',{}).values():
        for dimension in term['priceDimensions'].values():
            prices.append({'description':dimension['description'],'unit':dimension['unit'],
                           'usd':dimension['pricePerUnit']['USD'],'effective':term['effectiveDate']})
Path('evidence/aws/ebs-prices.json').write_text(json.dumps(prices,indent=2),encoding='utf-8')
print('Saved ALB cost inputs and official gp3 price')
