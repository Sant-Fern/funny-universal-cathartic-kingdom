"""Reproducible estimates at list prices, explicitly before credits/allowances."""
from decimal import Decimal as D
import json
from pathlib import Path

root=Path('evidence/aws')
load=Path('evidence/aws-load')
price=lambda name: json.loads((root/name).read_text(encoding='utf-8-sig'))
node=D(price('ec2-prices.json')['usd'])
generator=D(price('loadgen-prices.json')['usd'])
ebs=D(price('ebs-prices.json')[0]['usd'])
alb=price('alb-prices.json')
lb=D(next(x['usd'] for x in alb if x['usage']=='USE2-LoadBalancerUsage'))
lcu=D(next(x['usd'] for x in alb if 'LCUUsage' in x['usage']))
result={'currency':'USD','basis':'list prices before credits, Free Tier and taxes','prices':{
    'node_hour':str(node),'generator_hour':str(generator),'eks_cluster_hour':'0.10',
    'alb_hour':str(lb),'lcu_hour':str(lcu),'gp3_gb_month':str(ebs),'public_ipv4_hour':'0.005',
    'cloudfront_reference_gb':'0.085'},'scenarios':[]}
for count in (2,3,4,8,10):
    # 730-hour month convention. ALB assumes two public IPs; actual count can vary.
    fixed=node*count+D('.10')+lb+ebs*20*count/730+D('.005')*(count+2)
    result['scenarios'].append({'nodes':count,'fixed_hour':str(fixed.quantize(D('.00001'))),
                               'fixed_hour_at_1000_players':str((fixed/1000).quantize(D('.00000001')))})
result['generators_fixed_hour']=str(generator*2+ebs*32/730+D('.005')*2)
result['extrapolation_hls']={'viewers':20000,'kbps_each':6000,
    'bandwidth_gbps':str(D(20000)*6000/1000000),
    'decimal_gb_hour':str(D(20000)*6000*1000*3600/8/1000000000),
    'uniform_reference_egress_hour':str(D(20000)*6000*1000*3600/8/1000000000*D('.085')),
    'notes':'Mathematical scenario only. Uniform reference rate, no volume-tier discounts, no free allowance, no live 20k test.'}
result['measured_runs']=[]
for summary_file in load.glob('*/summary.json'):
    s=json.loads(summary_file.read_text())
    seconds=D(str(s['runner_elapsed_seconds']))
    if s['class']=='PogoUser' and s['connected_player_seconds']:
        payload=D(str(s['received_payload_bytes']))
        per_player=payload/D(str(s['connected_player_seconds']))
        ccu=D(str(s['peak_connected_receivers']))
        nodes=s['scaling_observations']['nodes']['max']
        entry={'label':s['label'],'received_payload_decimal_gb':str(payload/10**9),
            'payload_gb_per_player_hour':str(per_player*3600/10**9),
            'peak_connected_per_peak_node':str(ccu/D(str(nodes))) if nodes else None,
            'uniform_cf_payload_per_player_hour':str(per_player*3600/10**9*D('.085'))}
        cw=summary_file.parent/'cloudwatch-alb.json'
        if cw.exists():
            m=json.loads(cw.read_text())['metrics']
            values=[D(str(x['Average'])) for x in m['ConsumedLCUs']['datapoints']]
            entry['mean_lcus']=str(sum(values)/len(values)) if values else None
            entry['alb_variable_hour']=str(sum(values)/len(values)*lcu) if values else None
        if nodes and ccu:
            n=D(str(nodes))
            fixed=node*n+D('.10')+lb+ebs*20*n/730+D('.005')*(n+2)
            cf_hour=per_player*3600/10**9*D('.085')*ccu
            subtotal=fixed+cf_hour+D(entry.get('alb_variable_hour') or '0')
            entry['reference_compute_network_hour_at_peak']=str(subtotal)
            entry['reference_compute_network_per_player_hour']=str(subtotal/ccu)
            entry['subtotal_excludes']='API/Lambda/DynamoDB, ECR/S3, inter-AZ traffic, free allowances, credits and taxes'
        result['measured_runs'].append(entry)
result['excluded_from_fixed']=['LCU and CDN variable traffic','inter-AZ traffic','ECR/S3/DynamoDB storage and requests','Lambda/API requests and duration','monitoring and other account projects']
result['out_of_pocket']='0 while account remains FREE ACTIVE. Credits are consumed; availability ends at balance/plan expiry. Not permanent free hosting.'
(root/'integrator-costs.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
