"""Keep a real player connected while an operator updates/rolls back the Fleet."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect
from loadtest.smoke import socket_url


async def run(args):
    directory = Path(args.output)
    directory.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(base_url=args.url, timeout=10, trust_env=False) as client:
        response = await client.post('/api/join',json={'name':'QA-rollout','mode':'race'})
        response.raise_for_status()
        reservation = response.json()
        async with connect(socket_url(args.url,reservation),origin=args.url,proxy=None,max_size=2**20) as socket:
            welcome = json.loads(await asyncio.wait_for(socket.recv(),10))
            assert welcome['type']=='welcome'
            record = {'started_utc':datetime.now(timezone.utc).isoformat(),
                      'gameServer':reservation['gameServer'],'player':welcome['playerId'],
                      'seconds_requested':args.seconds}
            (directory/'connected.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
            end = time.monotonic()+args.seconds
            snapshots = pongs = 0
            next_ping = 0
            while time.monotonic()<end:
                if time.monotonic() >= next_ping:
                    await socket.send(json.dumps({'type':'ping','timestamp':time.monotonic()}))
                    next_ping = time.monotonic()+1
                message = json.loads(await asyncio.wait_for(socket.recv(),10))
                snapshots += 'players' in message
                pongs += message.get('type')=='pong'
            assert snapshots>0 and pongs>0
            record.update(status='passed',snapshots=snapshots,pongs=pongs,
                          ended_utc=datetime.now(timezone.utc).isoformat())
            (directory/'result.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
            print(json.dumps(record,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--seconds',type=int,default=90)
    asyncio.run(run(parser.parse_args()))
