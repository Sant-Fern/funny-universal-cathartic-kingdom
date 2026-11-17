"""Summarize preserved measurements; never equate desired users with CCU."""
import csv
from datetime import datetime
import json
import math
from pathlib import Path

ROOT = Path('evidence/aws-load')


def series(document, key):
    return [item for item in document.get('queries', {}).get(key, {}).get('response', {}).get('data', {}).get('result', [])]


def finite_values(document, key, start, end):
    return [float(value) for item in series(document, key) for t, value in item.get('values', [])
            if start<=float(t)<=end and math.isfinite(float(value))]


def main():
    summaries = []
    for directory in sorted(ROOT.iterdir()):
        if not directory.is_dir() or not (directory/'commands.json').exists():
            continue
        metadata = json.loads((directory/'commands.json').read_text(encoding='utf-8-sig'))
        runs = [json.loads(path.read_text(encoding='utf-8-sig')) for path in directory.glob('*/run.json')]
        master = next((item for item in runs if not item['worker_only']), None)
        if master is None:
            continue
        host = directory/master['generator']
        time_path = host/'pogo-timeseries.csv'
        times = list(csv.DictReader(time_path.open(encoding='utf-8-sig'))) if time_path.exists() else []
        stats_path = host/(directory.name+'_stats.csv')
        stats = list(csv.DictReader(stats_path.open(encoding='utf-8-sig'))) if stats_path.exists() else []
        requests = [row for row in stats if row['Name'] != 'Aggregated']
        prom = json.loads((directory/'prometheus.json').read_text()) if (directory/'prometheus.json').exists() else {}
        start, end = master['started_epoch'], master['ended_epoch']
        changes = {}
        for key in ('nodes', 'gateway_replicas', 'pending_pods'):
            items = series(prom, key)
            pairs = sorted((float(t), float(v)) for item in items for t,v in item.get('values', []) if start<=float(t)<=end and math.isfinite(float(v)))
            baseline = pairs[0][1] if pairs else None
            increase = next(((t,v) for t,v in pairs if v > baseline), None)
            changes[key] = {'initial': baseline, 'max': max((v for _,v in pairs),default=None),
                            'first_increase_seconds': round(increase[0]-start,1) if increase else None}
        def peak(field):
            return max((float(row.get(field, 0)) for row in times), default=0)
        player_seconds = sum(max(0, float(b['utc_epoch'])-float(a['utc_epoch']))*float(a['connected']) for a,b in zip(times,times[1:]))
        summary = {
            'label': directory.name, 'class': metadata['class'], 'tag': metadata['tag'],
            'desired_users': metadata['users'], 'rate':metadata['rate'],
            'requested_duration_seconds': metadata['duration'],
            'runner_elapsed_seconds':round(master['ended_epoch']-master['started_epoch'],1),
            'completed_requested_duration':master['ended_epoch']-master['started_epoch']>=metadata['duration'],
            'peak_locust_users':peak('locust_users'), 'peak_connected_receivers':peak('connected'),
            'peak_hls_viewers':peak('viewers'), 'max_worker_cpu_percent':peak('max_worker_cpu'),
            'peak_prometheus_ccu':max(finite_values(prom,'ccu',start,end),default=None),
            'max_rolling_tick_p99_ms':max(finite_values(prom,'active_tick_p99_ms',start,end),default=None),
            'scaling_observations':changes,
            'received_payload_bytes':peak('bytes'), 'connected_player_seconds':round(player_seconds,1),
            'input_events':peak('inputs'),
            'observed_inputs_per_player_second':round(peak('inputs')/player_seconds,2) if player_seconds else None,
            'payload_bytes_per_player_second':round(peak('bytes')/player_seconds,2) if player_seconds else None,
            'requests':[{ 'type':r['Type'], 'name':r['Name'], 'count':int(r['Request Count']),
                         'failures':int(r['Failure Count']), 'p50_ms':float(r['50%']),
                         'p95_ms':float(r['95%']), 'p99_ms':float(r['99%']),
                         'average_content_bytes':float(r['Average Content Size'])} for r in requests],
            'measurement_notes':['Prometheus samples every 15 seconds. Tick is active work, not end-to-end latency.',
                                 'Locust user count includes retries. Connected receivers and server CCU are separate observations.',
                                 'Exit code 0 does not imply no request failures. Inspect CSV counts.'],
        }
        (directory/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
        summaries.append(summary)
    (ROOT/'summary.json').write_text(json.dumps(summaries,indent=2),encoding='utf-8')
    for item in summaries:
        print(item['label'], 'users=',item['peak_locust_users'], 'connected=',item['peak_connected_receivers'],
              'failures=',sum(r['failures'] for r in item['requests']), 'seconds=',item['runner_elapsed_seconds'])


if __name__ == '__main__':
    main()
