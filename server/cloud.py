"""Agones REST lifecycle. Disabled outside a GameServer pod."""
import asyncio
import logging
import os
import time

import httpx

log = logging.getLogger("pogo.cloud")


async def lifecycle(runtime):
    port = os.environ.get("AGONES_SDK_HTTP_PORT")
    if not port:
        return
    async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{int(port)}", timeout=3) as client:
        for attempt in range(30):
            try:
                response = await client.post("/ready", json={})
                response.raise_for_status()
                break
            except httpx.HTTPError:
                if attempt == 29:
                    raise
                await asyncio.sleep(1)
        log.info("Agones Ready")
        last_busy = time.monotonic()
        occupied = False
        last_count = None
        while True:
            try:
                # A stalled simulation must fail its Agones health check.
                if time.monotonic() - runtime.last_tick < 5:
                    (await client.post("/health", json={})).raise_for_status()
                count = sum(len(room.connections) for room in runtime.rooms.values()) + len(runtime.tokens)
                if count != last_count:
                    (await client.patch("/v1beta1/counters/players", json={"count": str(count)})).raise_for_status()
                    last_count = count
                if count or runtime.results_pending:
                    occupied = True
                    last_busy = time.monotonic()
                elif occupied and time.monotonic() - last_busy > 90:
                    (await client.post("/shutdown", json={})).raise_for_status()
                    log.info("Agones Shutdown after idle session")
                    return
            except httpx.HTTPError as error:
                # Retry transient sidecar failures; sustained failures still fail health.
                log.warning("Agones lifecycle request failed: %s", type(error).__name__)
            await asyncio.sleep(2)


def metrics(runtime):
    """Prometheus histogram uses cumulative buckets, in seconds."""
    lines = ["# HELP pogo_ccu Connected human players.", "# TYPE pogo_ccu gauge"]
    for mode, room in runtime.rooms.items():
        lines.append(f'pogo_ccu{{mode="{mode}"}} {len(room.connections)}')
    lines += ["# HELP pogo_tick_seconds Authoritative work per active tick; idle rooms excluded.",
              "# TYPE pogo_tick_seconds histogram"]
    for bound, count in zip(runtime.tick_bounds, runtime.tick_buckets):
        lines.append(f'pogo_tick_seconds_bucket{{le="{bound}"}} {count}')
    lines += [f'pogo_tick_seconds_bucket{{le="+Inf"}} {runtime.tick_samples}',
              f"pogo_tick_seconds_count {runtime.tick_samples}",
              f"pogo_tick_seconds_sum {runtime.tick_total}",
              "# TYPE pogo_snapshot_dropped_total counter",
              f"pogo_snapshot_dropped_total {runtime.dropped}",
              "# TYPE pogo_results_saved_total counter",
              f"pogo_results_saved_total {runtime.results_saved}",
              "# TYPE pogo_results_failures_total counter",
              f"pogo_results_failures_total {runtime.results_failures}"]
    return "\n".join(lines) + "\n"
