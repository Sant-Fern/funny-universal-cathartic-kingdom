"""Deterministic authoritative arena. No network or rendering dependencies."""
from __future__ import annotations

import json
import math
import random
import uuid
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

CONFIG = json.loads((Path(__file__).parents[1] / "shared/arena.json").read_text())


def height_at(x, z):
    t = CONFIG["terrain"]
    return (t["waveHeight"] * math.sin(x*t["waveX"]) * math.cos(z*t["waveZ"])
            + t["rippleHeight"] * math.sin((x+z)*t["rippleFrequency"])
            + sum(m["height"]*math.exp(-((x-m["x"])**2+(z-m["z"])**2)/m["radius"]**2) for m in t["mounds"]))


OBSTACLES = [(o, height_at(o["x"], o["z"])) for o in CONFIG["obstacles"]]
FLAT_OBSTACLES = [(o, height_at(o["x"], o["z"])) for o in CONFIG["flatObstacles"]]
DECKS = [o for o, _ in OBSTACLES if o.get("tier")]
MIRADOR = next(o for o in DECKS if o["tier"] == 3)
STATION = next(o for o, _ in OBSTACLES if o.get("route") == "station")
SUMMIT = next(o for o, _ in OBSTACLES if o.get("route") == "summit")
UPPER_ROUTES = {kind: [o for o, _ in OBSTACLES if o.get("route") == kind]
                for kind in ("direct", "covered")}
HEAD_CLEARANCE = 2.05
BALLOON_TARGETS = CONFIG["balloons"]["targets"]
ALL_BALLOONS = (1 << len(BALLOON_TARGETS))-1


@lru_cache(maxsize=128)
def boxes_at(tick, mode="race"):
    """Collision volumes at a simulation tick, with h denoting the deck's top."""
    time = tick / CONFIG["tickRate"]
    boxes = []
    for o, terrain in (OBSTACLES if mode == "race" else FLAT_OBSTACLES):
        top = terrain+o["h"]
        motion = o.get("motion")
        if motion:
            axis = motion["axis"]
            delta = motion["amplitude"]*math.sin(math.tau*time/motion["period"]+motion["phase"])
            o = {**o, axis: o[axis]+delta}
        boxes.append((o, top-o.get("thickness", o["h"]), top))
    return tuple(boxes)


def overlaps(o, x, z, margin=0):
    return abs(x-o["x"]) < o["w"]/2+margin and abs(z-o["z"]) < o["d"]/2+margin


def support_height(x, z, ceiling, boxes=None):
    """The pogo tip can touch the floor or a deck it was already above."""
    floor = height_at(x, z)
    for o, _, top in (boxes if boxes is not None else boxes_at(0)):
        if floor < top <= ceiling and overlaps(o, x, z, .12):
            floor = top
    return floor


def jump_speed(power):
    return CONFIG["jumpMinSpeed"] + power*(CONFIG["jumpMaxSpeed"]-CONFIG["jumpMinSpeed"])


def overlaps_body(y, bottom, top):
    return y < top-1e-8 and y+HEAD_CLEARANCE > bottom+1e-8


def can_occupy(x, z, y, boxes=None):
    r = CONFIG["playerRadius"]
    if abs(x) > CONFIG["width"]/2-r or abs(z) > CONFIG["depth"]/2-r:
        return False
    return not any(overlaps_body(y, bottom, top) and overlaps(o, x, z, r)
                   for o, bottom, top in (boxes if boxes is not None else boxes_at(0)))


def slide_clear(x, z, y, boxes):
    radius = CONFIG["playerRadius"]
    for o, bottom, top in boxes:
        if not overlaps_body(y, bottom, top) or not overlaps(o, x, z, radius):
            continue
        edges = [(o["x"]+s*(o["w"]/2+radius+.001), z) for s in (-1, 1)]
        edges += [(x, o["z"]+s*(o["d"]/2+radius+.001)) for s in (-1, 1)]
        for edge_x, edge_z in sorted(edges, key=lambda edge: abs(edge[0]-x)+abs(edge[1]-z)):
            if can_occupy(edge_x, edge_z, y, boxes):
                return edge_x, edge_z
    return x, z


def steer_to(x, z, target, dt):
    dx, dz = target[0]-x, target[1]-z
    scale = max(CONFIG["airSpeed"]*dt, math.hypot(dx, dz))
    return dx/scale, dz/scale


def air_step(x, y, z, vy, move_x, move_z, dt, push_x=0, push_z=0, tick=0, boxes=None):
    """Advance one airborne tick. The bot planner uses the same physics as play."""
    vy -= CONFIG["gravity"]*dt
    next_y = y+vy*dt
    if boxes is None:
        boxes = boxes_at(tick)
    if vy > 0:
        for o, bottom, _ in boxes:
            if (y+HEAD_CLEARANCE <= bottom < next_y+HEAD_CLEARANCE
                    and overlaps(o, x, z, CONFIG["playerRadius"])):
                next_y, vy = bottom-HEAD_CLEARANCE, 0
    travel = CONFIG["airSpeed"]*dt / max(1, math.hypot(move_x, move_z))
    dx, dz = move_x*travel+push_x*dt, move_z*travel+push_z*dt
    # Allow the pogo to reach a ledge on the tick where it descends past its top.
    clearance = max(y, next_y)
    if can_occupy(x+dx, z, clearance, boxes):
        x += dx
    if can_occupy(x, z+dz, clearance, boxes):
        z += dz
    floor = support_height(x, z, y, boxes)
    landed = vy <= 0 and next_y <= floor
    if landed:
        next_y = floor
    # Slide a pogo that misses the top away from the vertical face.
    if not can_occupy(x, z, next_y, boxes):
        x, z = slide_clear(x, z, next_y, boxes)
        if landed and support_height(x, z, y, boxes) < next_y:
            landed = False
    return x, next_y, z, vy, landed


def hop_endpoint(p, target, power, start_tick=0, mode="race"):
    x, y, z, vy = p.x, p.y, p.z, jump_speed(power)
    dt = 1/CONFIG["tickRate"]
    for tick in range(start_tick+1, start_tick+41):
        dx, dz = steer_to(x, z, target, dt)
        x, y, z, vy, landed = air_step(x, y, z, vy, dx, dz, dt, boxes=boxes_at(tick, mode))
        if landed:
            return x, y, z
    return None


def bottle_config(kind):
    return CONFIG["heavyBottle"] if kind == "heavy" else CONFIG


def launch_velocity(yaw, pitch, power, kind="standard"):
    angle = max(.12, min(1.2, .56+pitch))
    stats = bottle_config(kind)
    speed = stats["shotMinSpeed"] + max(0, min(1, power)) * (stats["shotSpeed"]-stats["shotMinSpeed"])
    return (math.sin(yaw)*math.cos(angle)*speed, math.sin(angle)*speed,
            math.cos(yaw)*math.cos(angle)*speed)


def throw_origin(p):
    return (p.x+math.cos(p.yaw)*.3+math.sin(p.yaw)*.35, p.y+CONFIG["throwHeight"],
            p.z-math.sin(p.yaw)*.3+math.cos(p.yaw)*.35)


@dataclass
class Controls:
    seq: int = -1
    move_x: float = 0
    move_z: float = 0
    yaw: float = 0
    pitch: float = 0
    fire: bool = False
    received_at: float = -100
    power: float = .6


@dataclass
class Player:
    id: str
    name: str
    team: int | None
    bot: bool = True
    x: float = 0
    y: float = 0
    z: float = 0
    vy: float = 0
    yaw: float = 0
    health: int = 100
    pops: int = 0
    best_height: float = 0
    balloons: int = ALL_BALLOONS
    protected_until: float = 0
    next_shot: float = 0
    next_think: float = 0
    grounded: bool = True
    landed_at: float = -100
    jumped_at: float = -100
    impact_speed: float = 0
    next_bot_jump: float = 0
    bot_destination: tuple[float, float] | None = None
    jump_requested: tuple[float, float] | None = None
    last_throw_at: float = -100
    hit_at: float = -100
    hit_yaw: float = 0
    hit_force: float = 0
    hit_by: str | None = None
    push_x: float = 0
    push_z: float = 0
    push_until: float = 0
    bottle: str = "standard"
    throw_requested: bool = False
    requested_aim: tuple | None = None
    controls: Controls = field(default_factory=Controls)


@dataclass
class Shot:
    id: int
    owner: str
    team: int | None
    x: float
    y: float
    z: float
    vx: float
    vy: float
    vz: float
    ttl: float = 4
    age: float = 0
    kind: str = "standard"
    owner_bot: bool = False


def segment_box(start, end, low, high):
    """First t in [0, 1] where a segment intersects a closed AABB."""
    near, far = 0.0, 1.0
    for a, b, lo, hi in zip(start, end, low, high):
        d = b - a
        if abs(d) < 1e-9:
            if not lo <= a <= hi:
                return None
            continue
        t1, t2 = (lo - a) / d, (hi - a) / d
        near, far = max(near, min(t1, t2)), min(far, max(t1, t2))
        if near > far:
            return None
    return near


def segment_sphere(start, end, center, radius):
    delta = [b - a for a, b in zip(start, end)]
    offset = [a - c for a, c in zip(start, center)]
    a = sum(d * d for d in delta)
    c = sum(o * o for o in offset) - radius * radius
    if c <= 0:
        return 0.0
    if a < 1e-10:
        return None
    b = 2 * sum(o * d for o, d in zip(offset, delta))
    discriminant = b * b - 4 * a * c
    if discriminant < 0:
        return None
    t = (-b - math.sqrt(discriminant)) / (2 * a)
    return t if 0 <= t <= 1 else None


class Arena:
    def __init__(self, seed=None, duration=None, mode="eliminations"):
        self.rng = random.Random(seed)
        self.id = str(uuid.uuid4())
        self.time = 0.0
        default_duration = CONFIG["race"]["duration"] if mode == "race" else CONFIG["duration"]
        self.duration = default_duration if duration is None else duration
        self.started = False
        self.finished = False
        self.score = [0, 0]
        self.mode = mode
        self.winner = None
        self.players: dict[str, Player] = {}
        self.shots: list[Shot] = []
        self.shot_id = 0
        self.events = []
        self.impacts = []
        self.recent_impacts = []
        names = ["Tibia", "Fémur", "Costilla", "Cráneo", "Rótula", "Húmero", "Radio", "Cúbito", "Falange", "Sacro"]
        for i, name in enumerate(names):
            p = Player(f"slot-{i}", name, i % 2 if mode == "race" else None)
            self.players[p.id] = p
            self.spawn(p)

    @property
    def humans(self):
        return sum(not p.bot for p in self.players.values())

    def spawn(self, p):
        slot = int(p.id.split("-")[-1])
        index = slot//2 if self.mode == "race" else slot
        if self.mode == "race":
            p.x = (-1 if p.team == 0 else 1)*CONFIG["spawnX"] + self.rng.uniform(-0.4, 0.4)
            p.z = (index - (CONFIG["teamSize"]-1)/2)*CONFIG["spawnSpacing"]
        else:
            angle = math.tau*slot/(2*CONFIG["teamSize"])
            p.x, p.z = math.cos(angle)*19, math.sin(angle)*14
        p.y, p.vy = height_at(p.x, p.z), 0
        p.yaw = math.atan2(-p.x, -p.z) if self.mode == "eliminations" else (math.pi/2 if p.team == 0 else -math.pi/2)
        p.protected_until = self.time + (4 if self.mode == "eliminations" else 1.5)
        p.controls = Controls(yaw=p.yaw)
        p.throw_requested, p.requested_aim = False, None
        p.grounded, p.jump_requested = True, None
        p.jumped_at, p.landed_at, p.last_throw_at, p.impact_speed = -100, -100, -100, 0
        p.hit_at, p.hit_yaw, p.hit_force, p.hit_by = -100, 0, 0, None
        p.push_x, p.push_z, p.push_until = 0, 0, 0
        p.next_bot_jump = self.time + .25 + (index % 3)*.18
        p.bot_destination = None

    def join(self, name):
        if self.finished:
            raise ValueError("La partida terminó. Espera a que los jugadores vuelvan al inicio.")
        candidates = [p for p in self.players.values() if p.bot]
        if not candidates:
            raise ValueError("La sala está llena (10 jugadores).")
        if self.mode == "race":
            counts = [sum(not p.bot and p.team == team for p in self.players.values()) for team in (0, 1)]
            team = 0 if counts[0] <= counts[1] else 1
            p = next(p for p in candidates if p.team == team)
        else:
            p = max(candidates, key=lambda candidate: candidate.balloons.bit_count())
        p.bot, p.name = False, name
        p.pops = 0
        p.bottle = "standard"
        if not self.started:
            self.spawn(p)
        p.controls = Controls(yaw=p.yaw)
        p.jump_requested, p.bot_destination = None, None
        p.throw_requested, p.requested_aim = False, None
        self.started = True
        return p

    def leave(self, player_id):
        p = self.players[player_id]
        p.bot, p.name = True, f"Huesito {player_id.split('-')[-1]}"
        p.bottle = "standard"
        p.controls = Controls()
        p.jump_requested = None
        p.bot_destination = None
        p.throw_requested, p.requested_aim = False, None
        self.shots = [shot for shot in self.shots if shot.owner != player_id]

    def apply_input(self, player_id, message):
        p = self.players[player_id]
        if p.health <= 0 or message.seq <= p.controls.seq:
            return
        p.controls = Controls(seq=message.seq, move_x=message.moveX, move_z=message.moveZ, yaw=message.yaw,
                              pitch=message.pitch, fire=message.fire, received_at=self.time, power=message.power)
        p.bottle = message.bottle
        if message.fire:
            # Preserve the discrete release event even if a newer movement packet arrives before the next tick.
            p.throw_requested = True
            p.requested_aim = (message.yaw, message.pitch, message.power, message.bottle)
        if message.jumpPower is not None and p.grounded and p.health > 0:
            p.jump_requested = (message.jumpPower, self.time+.2)

    def hop_toward(self, p, goal):
        dx, dz = goal[0]-p.x, goal[1]-p.z
        distance = math.hypot(dx, dz)
        if distance < .15:
            return None
        power = .52 if distance < 2.1 else .8 if distance < 4.3 else 1
        best_distance, plan = distance, None

        def consider(destination, strength):
            nonlocal best_distance, plan
            end = hop_endpoint(p, destination, strength, round(self.time*CONFIG["tickRate"]), self.mode)
            if end is None:
                return
            remaining = math.hypot(end[0]-goal[0], end[2]-goal[1])
            if remaining < best_distance-.05:
                best_distance, plan = remaining, (destination, strength)

        consider(goal, power)
        if power < 1 and best_distance > .5:
            consider(goal, 1)
        if distance-best_distance < min(1.2, distance*.45):
            # Look around a cabinet if a straight hop would hit its face.
            heading = math.atan2(dz, dx)
            for offset in (-.62, .62, -1.18, 1.18, -1.55, 1.55):
                angle = heading+offset
                consider((p.x+math.cos(angle)*4.2, p.z+math.sin(angle)*4.2), .86)
        return plan

    def deck_hop(self, p, deck, goal):
        if math.hypot(goal[0]-p.x, goal[1]-p.z) > 6.5:
            return None
        end = hop_endpoint(p, goal, 1, round(self.time*CONFIG["tickRate"]))
        top = height_at(deck["x"], deck["z"])+deck["h"]
        if end and abs(end[1]-top) < .01 and overlaps(deck, end[0], end[2], -.22):
            return goal, 1
        return None

    def platform_hop(self, p, column):
        # Two climbers per team take different approaches. The rest fight from the lanes.
        axis = "x" if column == 1+2*p.team else "z"
        side = (2*p.team-1) if axis == "x" else (1-2*p.team)
        route = sorted((o for o in DECKS if o[axis]*side > 0 or o["tier"] == 3), key=lambda o: o["tier"])
        current = next((o for o in DECKS if overlaps(o, p.x, p.z, .12)
                        and abs(p.y-height_at(o["x"], o["z"])-o["h"]) < .01), None)
        if current is MIRADOR:
            x = (2*p.team-1)*self.rng.uniform(.85, 1.65)
            z = (1 if column == 3 else -1)*self.rng.uniform(.55, 1.4)
            return (x, z), .52
        deck = route[current["tier"] if current else 0]
        goal = (deck["x"], deck["z"])
        # Slightly different perches on top keep multiple climbers out of the same spot.
        if deck is MIRADOR:
            goal = ((2*p.team-1)*.6, (.6 if column == 3 else -.6))
        plan = self.deck_hop(p, deck, goal)
        if plan:
            return plan
        if current:
            return self.hop_toward(p, (current["x"], current["z"]))
        first = route[0]
        size = first["w" if axis == "x" else "d"]
        approach = first[axis]+side*(size/2+1.65)
        return self.hop_toward(p, (approach, 0) if axis == "x" else (0, approach))

    def ascent_hop(self, p, column, goal, finish):
        current = next((o for route in UPPER_ROUTES.values() for o in route
                        if abs(p.y-o["h"]) < .01 and overlaps(o, p.x, p.z, .12)), None)
        if p.y >= finish["h"]:
            return self.deck_hop(p, finish, goal) or self.hop_toward(p, goal)
        if p.y < MIRADOR["h"] and current is None:
            return self.platform_hop(p, 1 if column == 2 else column)
        branch = current["route"] if current else ("direct" if (column+p.team)%2 else "covered")
        stages = [*UPPER_ROUTES[branch], STATION, SUMMIT]
        for deck in sorted(stages, key=lambda deck: deck["h"]):
            if not p.y < deck["h"] <= finish["h"]:
                continue
            landing = goal if deck is finish else (deck["x"], deck["z"])
            plan = self.deck_hop(p, deck, landing)
            if plan is not None:
                return plan
        # If a blast moves the bot to the lip, line up the approach again.
        origin = current or (STATION if p.y >= STATION["h"] else MIRADOR)
        return self.hop_toward(p, (origin["x"], origin["z"]))

    def ground_fight_hop(self, p, target, column):
        dx, dz = target.x-p.x, target.z-p.z
        distance = max(.01, math.hypot(dx, dz))
        side = 1 if (column + int(self.time/2.5)) % 2 else -1
        if distance > 12:
            goal = (target.x-dx/distance*7+dz/distance*side*2,
                    target.z-dz/distance*7-dx/distance*side*2)
        else:
            advance = 1.4 if distance > 8.5 else -1.9 if distance < 5.5 else 0
            goal = (p.x+(dx*advance+dz*side*3.5)/distance,
                    p.z+(dz*advance-dx*side*3.5)/distance)
        return self.hop_toward(p, goal)

    def is_opponent(self, player, owner_id, owner_team, owner_bot):
        if player.health <= 0 or player.id == owner_id:
            return False
        if self.mode == "race":
            return player.team != owner_team
        return not (owner_bot and player.bot)

    def think(self, p):
        p.next_think = self.time + .2
        opponents = [e for e in self.players.values() if self.is_opponent(e, p.id, p.team, True)]
        target = min(opponents, key=lambda e: math.hypot(e.x-p.x, e.z-p.z), default=None)
        column = int(p.id.split('-')[-1])//2
        if p.grounded and self.time >= p.next_bot_jump:
            if self.mode == "race":
                plan = self.ascent_hop(p, column, (SUMMIT["x"], SUMMIT["z"]), SUMMIT)
            else:
                nearby = target or min(
                    (e for e in self.players.values() if e is not p and e.health > 0),
                    key=lambda e: math.hypot(e.x-p.x, e.z-p.z), default=None)
                plan = self.ground_fight_hop(p, nearby, column) if nearby else None
            if plan is not None:
                p.bot_destination, strength = plan
                p.jump_requested = (strength, self.time+.2)
            p.next_bot_jump = self.time+.2
        if target is None:
            p.controls.fire = False
            return

        if self.mode == "eliminations":
            # Spread the pressure in solo play. At most the three nearest bots
            # to a target attempt shots; stray shots never pop bot balloons.
            closest = sorted(
                (e for e in self.players.values() if e.bot and e.health > 0),
                key=lambda e: math.hypot(e.x-target.x, e.z-target.z))[:3]
            may_fire = any(e is p for e in closest)
            balloon = max(i for i in range(len(BALLOON_TARGETS)) if target.balloons & (1 << i))
            offset_x, hit_height, offset_z = BALLOON_TARGETS[balloon]
        else:
            may_fire = abs(target.y-p.y) < 2.5
            offset_x, hit_height, offset_z = 0, CONFIG["hitHeight"], 0

        distance = math.hypot(target.x-p.x, target.z-p.z)
        power = min(1, max(.5, distance/24+.2))
        speed = CONFIG["shotMinSpeed"] + power*(CONFIG["shotSpeed"]-CONFIG["shotMinSpeed"])
        flight = distance/max(1, speed*.9)
        if target.grounded:
            vx = vz = 0
        elif target.bot_destination is not None:
            vx, vz = steer_to(target.x, target.z, target.bot_destination, 1/CONFIG["tickRate"])
        else:
            vx, vz = target.controls.move_x, target.controls.move_z
        norm = max(1, math.hypot(vx, vz))
        lead_x = target.x + vx/norm*CONFIG["airSpeed"]*min(.35, flight)*.75
        lead_z = target.z + vz/norm*CONFIG["airSpeed"]*min(.35, flight)*.75
        lead_y, lead_vy = target.y, target.vy
        boxes = boxes_at(round(self.time*CONFIG["tickRate"]), self.mode)
        for _ in range(max(1, int(flight/.025))):
            surface = support_height(lead_x, lead_z, lead_y, boxes)
            lead_vy -= CONFIG["gravity"]*.025
            lead_y += lead_vy*.025
            if lead_y <= surface:
                lead_y = surface
                break
        dx, dz = lead_x+offset_x-p.x, lead_z+offset_z-p.z
        distance = max(.01, math.hypot(dx,dz))
        dy = lead_y+hit_height-p.y-CONFIG["throwHeight"]
        g = CONFIG["shotGravity"]
        discriminant = speed**4-g*(g*distance*distance+2*dy*speed*speed)
        angle = math.atan2(speed*speed-math.sqrt(discriminant),g*distance) if discriminant>=0 else .85
        p.controls = Controls(yaw=math.atan2(dx, dz) + self.rng.uniform(-.045, .045),
                              pitch=max(-.44,min(.64,angle-.56)),
                              fire=may_fire and distance < 27 and self.rng.random() > .4,
                              received_at=self.time, power=power)

    def can_move(self, x, z, y):
        return can_occupy(x, z, y, boxes_at(round(self.time*CONFIG["tickRate"]), self.mode))

    def pop_balloon(self, victim, attacker, index, direction):
        victim.balloons &= ~(1 << index)
        victim.hit_at, victim.hit_yaw, victim.hit_by = self.time, direction, attacker.id
        victim.hit_force = .64
        victim.protected_until = self.time+1.25
        attacker.pops += 1
        if not victim.balloons:
            victim.health = 0
            victim.jump_requested = None
            self.events.append({"attacker": attacker.name, "victim": victim.name, "team": None})
        return 1, int(not victim.balloons)

    def shove(self, victim, attacker, direction, force):
        if victim.protected_until > self.time or self.time < victim.push_until+.24:
            return False
        speed = CONFIG["heavyBottle"]["pushSpeed"]*force
        victim.push_x, victim.push_z = math.sin(direction)*speed, math.cos(direction)*speed
        victim.push_until = self.time+CONFIG["heavyBottle"]["pushSeconds"]
        victim.hit_at, victim.hit_yaw, victim.hit_by = self.time, direction, attacker.id
        victim.hit_force = force
        if victim.grounded:
            victim.grounded = False
            victim.vy = CONFIG["jumpMinSpeed"]+.25
            victim.jump_requested = None
        return True

    def burst(self, shot, point, victim, balloon, boxes):
        attacker = self.players[shot.owner]
        direction = math.atan2(shot.vx, shot.vz)
        if self.mode == "eliminations":
            return self.pop_balloon(victim, attacker, balloon, direction) if victim is not None else (0, 0)
        if shot.kind == "standard":
            hit = victim is not None and self.shove(victim, attacker, direction, .60)
            return int(hit), 0
        hits = 0
        x, y, z = point
        radius = CONFIG["heavyBottle"]["splashRadius"]
        for p in self.players.values():
            if not self.is_opponent(p, shot.owner, shot.team, shot.owner_bot):
                continue
            body_y = min(p.y+CONFIG["hitHeight"], max(p.y+.25, y))
            distance = math.dist(point, (p.x, body_y, p.z))
            if p is not victim and distance > radius:
                continue
            chest = (p.x, p.y+CONFIG["hitHeight"], p.z)
            if p is not victim and any(
                segment_box(point, chest, (o["x"]-o["w"]/2, bottom, o["z"]-o["d"]/2),
                            (o["x"]+o["w"]/2, top, o["z"]+o["d"]/2)) is not None
                for o, bottom, top in boxes
            ):
                continue
            force = 1 if p is victim else 1-.68*distance/radius
            shove = direction if p is victim else math.atan2(p.x-x, p.z-z)
            hits += int(self.shove(p, attacker, shove, force))
        return hits, 0

    def finish_round(self, winner=None):
        self.winner = winner
        self.finished = True
        self.shots.clear()

    def check_finish(self):
        if self.mode == "race":
            arrived = set()
            for p in self.players.values():
                if not p.grounded:
                    continue
                p.best_height = max(p.best_height, round(p.y, 2))
                self.score[p.team] = max(self.score[p.team], p.best_height)
                if (abs(p.y-SUMMIT["h"]) < .02
                        and math.hypot(p.x-SUMMIT["x"], p.z-SUMMIT["z"]) <= CONFIG["race"]["finishRadius"]):
                    arrived.add(p.team)
            if arrived:
                self.finish_round(next(iter(arrived)) if len(arrived) == 1 else None)
            elif self.time >= self.duration:
                self.finish_round()
        else:
            survivors = [p for p in self.players.values() if p.balloons]
            if len(survivors) <= 1 or self.time >= self.duration:
                best = max((p.balloons.bit_count() for p in survivors), default=0)
                leaders = [p.id for p in survivors if p.balloons.bit_count() == best]
                self.finish_round(leaders[0] if len(leaders) == 1 else None)

    def step(self, dt):
        if not self.started or self.finished:
            return
        previous_time = self.time
        self.time = min(self.duration, self.time + dt)
        if self.duration-self.time < 1e-8:
            self.time = self.duration
        dt = self.time-previous_time
        tick = round(self.time*CONFIG["tickRate"])
        boxes = boxes_at(tick, self.mode)
        previous_boxes = boxes_at(round(previous_time*CONFIG["tickRate"]), self.mode)
        moving = [(old, new, top) for (old, _, _), (new, _, top) in zip(previous_boxes, boxes)
                  if new.get("motion")]
        self.events = []
        self.impacts = []
        for p in self.players.values():
            if p.health <= 0:
                continue
            if p.grounded:
                for old, new, top in moving:
                    if abs(p.y-top) < .012 and overlaps(old, p.x, p.z, .12):
                        p.x += new["x"]-old["x"]
                        p.z += new["z"]-old["z"]
                        break
                if not can_occupy(p.x, p.z, p.y, boxes):
                    p.x, p.z = slide_clear(p.x, p.z, p.y, boxes)
                if support_height(p.x, p.z, p.y, boxes) < p.y-1e-8:
                    p.grounded = False
            if p.bot and self.time >= p.next_think:
                self.think(p)
            c = p.controls
            if self.time - c.received_at > 0.5:
                c.move_x = c.move_z = 0
                c.fire = False
            p.yaw = c.yaw
            if p.jump_requested is not None:
                jump_power, expires_at = p.jump_requested
                if not p.grounded or self.time > expires_at:
                    p.jump_requested = None
                elif self.time-p.landed_at >= CONFIG["landingRecovery"]-1e-8:
                    p.vy = jump_speed(jump_power)
                    p.grounded, p.jump_requested = False, None
                    p.jumped_at = self.time
            if not p.grounded:
                dx, dz = c.move_x, c.move_z
                if p.bot and p.bot_destination is not None:
                    dx, dz = steer_to(p.x, p.z, p.bot_destination, dt)
                push = max(0, min(1, (p.push_until-previous_time)/CONFIG["heavyBottle"]["pushSeconds"]))
                p.x, p.y, p.z, p.vy, p.grounded = air_step(
                    p.x, p.y, p.z, p.vy, dx, dz, dt, p.push_x*push, p.push_z*push, boxes=boxes)
                if p.grounded:
                    p.landed_at, p.impact_speed = self.time, -p.vy
                    p.vy = 0
                    if p.bot:
                        p.bot_destination = None
                        rest = self.rng.uniform(1.5, 2.5) if self.mode == "race" else self.rng.uniform(.23, .53)
                        p.next_bot_jump = self.time+rest
            should_throw = c.fire if p.bot else p.throw_requested
            p.throw_requested = False
            if should_throw and self.time >= p.next_shot:
                yaw,pitch,power,kind = p.requested_aim if not p.bot and p.requested_aim else (c.yaw,c.pitch,c.power,"standard")
                stats = bottle_config(kind)
                cooldown = 1.9 if p.bot and self.mode == "eliminations" else 1
                p.next_shot = self.time + stats["shotInterval"]*cooldown
                p.last_throw_at = self.time
                p.yaw = yaw
                self.shot_id += 1
                self.shots.append(Shot(self.shot_id,p.id,p.team,*throw_origin(p),*launch_velocity(yaw,pitch,power,kind),
                                       stats["shotLifetime"],kind=kind,owner_bot=p.bot))
        if self.mode == "race":
            self.check_finish()
            if self.finished:
                return
        kept = []
        for shot in self.shots:
            stats = bottle_config(shot.kind)
            gravity = stats["shotGravity"]
            start = (shot.x, shot.y, shot.z)
            end = (shot.x+shot.vx*dt, shot.y+shot.vy*dt-.5*gravity*dt*dt, shot.z+shot.vz*dt)
            hit_t, victim = 2.0, None
            balloon = None
            radius = stats["shotRadius"]
            for (old, _, _), (o, bottom, top) in zip(previous_boxes, boxes):
                relative_start = (start[0]+o["x"]-old["x"], start[1], start[2]+o["z"]-old["z"])
                t = segment_box(relative_start,end,(o["x"]-o["w"]/2-radius,bottom-radius,o["z"]-o["d"]/2-radius),
                                (o["x"]+o["w"]/2+radius,top+radius,o["z"]+o["d"]/2+radius))
                if t is not None and t < hit_t:
                    hit_t, victim = t, None
            for p in self.players.values():
                if not self.is_opponent(p, shot.owner, shot.team, shot.owner_bot):
                    continue
                body_hit = segment_sphere(start, end, (p.x, p.y+CONFIG["hitHeight"], p.z), CONFIG["hitRadius"]+radius)
                if self.mode == "eliminations":
                    if body_hit is not None and body_hit < hit_t:
                        hit_t, victim, balloon = body_hit, None, None
                    if p.protected_until > self.time:
                        continue
                    for index, (dx, dy, dz) in enumerate(BALLOON_TARGETS):
                        if not p.balloons & (1 << index):
                            continue
                        t = segment_sphere(start, end, (p.x+dx, p.y+dy, p.z+dz), CONFIG["balloons"]["radius"]+radius)
                        if t is not None and t < hit_t:
                            hit_t, victim, balloon = t, p, index
                else:
                    if body_hit is not None and body_hit < hit_t:
                        hit_t, victim = body_hit, p
            if end[1]-radius <= height_at(end[0],end[2]):
                low,high=0.0,1.0
                for _ in range(10):
                    m=(low+high)/2
                    x,y,z=(a+(b-a)*m for a,b in zip(start,end))
                    if y-radius<=height_at(x,z): high=m
                    else: low=m
                if high<hit_t: hit_t,victim=high,None
            for axis,limit in ((0,CONFIG["width"]/2),(2,CONFIG["depth"]/2)):
                if abs(end[axis])>limit:
                    t=((limit if end[axis]>0 else -limit)-start[axis])/(end[axis]-start[axis])
                    if t<hit_t: hit_t,victim=max(0,t),None
            shot.ttl -= dt
            shot.age += dt
            shot.vy -= gravity*dt
            if hit_t<=1:
                point = tuple(a+(b-a)*hit_t for a,b in zip(start,end))
                hits, downs = self.burst(shot, point, victim, balloon, boxes)
                self.impacts.append({"id":shot.id,"team":shot.team,"owner":shot.owner,"kind":shot.kind,"hits":hits,"downs":downs,
                                     **dict(zip(("x","y","z"), (round(value,3) for value in point)))})
            elif shot.ttl > 0:
                shot.x, shot.y, shot.z = end
                kept.append(shot)
        self.shots = kept
        self.recent_impacts = [(t, impact) for t, impact in self.recent_impacts if self.time-t < .3]
        self.recent_impacts.extend((self.time, impact) for impact in self.impacts)
        if self.mode == "eliminations":
            self.check_finish()

    def snapshot(self):
        return {"type": "snapshot", "matchId": self.id, "time": round(self.time, 3),
                "mode":self.mode,
                "remaining": max(0, round(self.duration - self.time, 2)),
                "status": "finished" if self.finished else ("playing" if self.started else "waiting"),
                "score": self.score.copy(), "humans": self.humans, "bots": 10 - self.humans,
                "winner": self.winner,
                "players": [{"id": p.id, "name": p.name, "team": p.team, "bot": p.bot,
                             "x": round(p.x, 3), "y": round(p.y, 3), "z": round(p.z, 3),
                             "yaw": round(p.yaw, 3), "health": p.health,
                             "balloons": p.balloons if self.mode == "eliminations" else None,
                             "balloonCount": p.balloons.bit_count() if self.mode == "eliminations" else None,
                             "pops": p.pops, "bestHeight": p.best_height,
                             "vy":round(p.vy,3),"grounded":p.grounded,"landedAt":round(p.landed_at,3),
                             "jumpedAt":round(p.jumped_at,3),"impactSpeed":round(p.impact_speed,3),
                             "lastThrowAt":round(p.last_throw_at,3),"bottle":p.bottle,
                             "hitAt":round(p.hit_at,3),"hitYaw":round(p.hit_yaw,3),"hitForce":round(p.hit_force,3),"hitBy":p.hit_by,
                             "throwCooldown":round(max(0,p.next_shot-self.time),3),
                             "protected": p.protected_until > self.time} for p in self.players.values()],
                "shots": [{"id":s.id,"team":s.team,"kind":s.kind,"x":round(s.x,3),"y":round(s.y,3),"z":round(s.z,3),
                           "vx":round(s.vx,3),"vy":round(s.vy,3),"vz":round(s.vz,3),"age":round(s.age,3)} for s in self.shots],
                "events": self.events.copy(),"impacts":[impact for _, impact in self.recent_impacts]}
