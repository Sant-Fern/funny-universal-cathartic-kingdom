import math

import pytest

from server.app import Input
from server.game import Arena, BALLOON_TARGETS, CONFIG, HEAD_CLEARANCE, MIRADOR, STATION, SUMMIT, UPPER_ROUTES, boxes_at, hop_endpoint, overlaps, segment_box, segment_sphere


def controls(seq=0, **kwargs):
    defaults = dict(type="input", seq=seq, moveX=0, moveZ=0, yaw=0, pitch=0, fire=False)
    return Input(**(defaults | kwargs))


def test_humans_replace_bots_balanced_and_capacity_is_ten():
    arena = Arena(seed=1, mode="race")
    for i in range(10):
        arena.join(f"Jugador {i}")
        assert len(arena.players) == 10
    assert arena.humans == 10
    assert [sum(p.team == t for p in arena.players.values()) for t in (0, 1)] == [5, 5]
    with pytest.raises(ValueError, match="llena"):
        arena.join("Once")
    arena.leave("slot-0")
    assert arena.humans == 9
    assert arena.join("Reemplazo").id == "slot-0"


def test_player_can_only_move_while_airborne():
    arena = Arena(seed=2, mode="race")
    p = arena.join("Prueba")
    arena.players = {p.id: p}
    p.x, p.z = -22, 9
    start = (p.x, p.z)
    for seq in range(10):
        arena.apply_input(p.id, controls(seq, moveX=1, moveZ=1))
        arena.step(.05)
    assert (p.x, p.z) == start and p.grounded

    arena.apply_input(p.id, controls(10, moveX=1, moveZ=1, jumpPower=1))
    arena.step(0.05)
    assert math.hypot(p.x-start[0], p.z-start[1]) == pytest.approx(CONFIG["airSpeed"] * 0.05)
    for _ in range(12):
        arena.step(.05)
    assert not p.grounded
    start = (p.x, p.z)
    for _ in range(10):
        arena.step(.05)
    assert (p.x, p.z) == start and p.grounded
    arena.apply_input(p.id, controls(11, moveX=1))
    arena.step(.05)
    assert (p.x, p.z) == start and p.grounded


def test_old_sequences_do_not_override_new_input():
    arena = Arena(seed=1, mode="race")
    p = arena.join("Prueba")
    arena.apply_input(p.id, controls(seq=5))
    arena.apply_input(p.id, controls(seq=4))
    assert p.controls.seq == 5


def test_collisions_boundaries_and_obstacle():
    arena = Arena(mode="race")
    assert not arena.can_move(CONFIG["width"]/2, 0, 0)
    assert arena.can_move(0, 0, 0)
    assert not arena.can_move(0, 0, MIRADOR["h"]-.1)
    assert arena.can_move(0, 0, 6)
    assert segment_box((-5, 1, 0), (5, 1, 0), (-1, 0, -1), (1, 2, 1)) == pytest.approx(0.4)
    assert segment_sphere((-5, 1, 0), (5, 1, 0), (0, 1, 0), 1) == pytest.approx(0.4)


def test_balloon_round_awards_the_most_intact_balloons_at_timeout():
    arena = Arena(seed=4, duration=2)
    first = arena.join("Uno")
    second = arena.join("Dos")
    assert all(p.team is None for p in arena.players.values())
    for p in arena.players.values():
        if p not in (first, second):
            p.balloons, p.health = 0, 0
    second.balloons = 1
    arena.time = 1.95
    arena.step(.05)
    assert arena.snapshot()["winner"] == first.id
    assert arena.snapshot()["status"] == "finished"


def test_timer_tie_and_simulation_freezes_at_end():
    arena = Arena(seed=2, duration=0.1)
    arena.join("Prueba")
    arena.step(0.05)
    arena.step(0.05)
    snapshot = arena.snapshot()
    assert snapshot["status"] == "finished"
    assert snapshot["remaining"] == 0
    assert snapshot["winner"] is None
    arena.step(50)
    assert arena.snapshot() == snapshot


def test_flat_arena_has_low_cover_and_no_tower_collision():
    flat, tower = Arena(), Arena(mode="race")
    assert max(top for _, _, top in boxes_at(0, "eliminations")) < 2
    assert flat.can_move(0, 0, MIRADOR["h"]-.1)
    assert not tower.can_move(0, 0, MIRADOR["h"]-.1)


@pytest.mark.parametrize("branch", ["direct", "covered"])
def test_summit_can_be_reached_via_both_upper_routes(branch):
    p = Arena(seed=1).join("Prueba")
    p.x, p.y, p.z = MIRADOR["x"], MIRADOR["h"], MIRADOR["z"]
    assert hop_endpoint(p, (SUMMIT["x"], SUMMIT["z"]), 1)[1] < SUMMIT["h"]
    for deck in sorted([*UPPER_ROUTES[branch], STATION, SUMMIT], key=lambda deck:deck["h"]):
        p.x, p.y, p.z = hop_endpoint(p, (deck["x"], deck["z"]), 1)
        assert p.y == pytest.approx(deck["h"])
        assert overlaps(deck, p.x, p.z)


def test_race_requires_landing_in_the_finish_ring():
    arena = Arena(seed=1, mode="race")
    mint, coral = arena.join("Menta"), arena.join("Coral")
    arena.players = {p.id: p for p in (mint, coral)}
    mint.x, mint.y, mint.z = SUMMIT["x"], SUMMIT["h"]+.35, SUMMIT["z"]
    mint.grounded, mint.vy = False, -1
    arena.step(.05)
    assert not arena.finished
    for _ in range(15):
        arena.step(.05)
    assert arena.finished and arena.winner == mint.team
    assert arena.score == [SUMMIT["h"], 0]
    assert coral.health == mint.health == 100


@pytest.mark.parametrize("seed", [1, 2])
def test_race_bots_can_finish(seed):
    arena = Arena(seed=seed, mode="race")
    arena.join("Prueba")
    for _ in range(2000):
        arena.step(.05)
        if arena.finished:
            break
    assert arena.finished and max(arena.score) == SUMMIT["h"]
    assert arena.time > 30
    assert all(p.health == 100 for p in arena.players.values())


def test_pogo_cannot_pass_upward_through_a_suspended_deck():
    arena = Arena(seed=1, mode="race")
    p = arena.join("Prueba")
    arena.players = {p.id: p}
    p.x, p.z = MIRADOR["x"], MIRADOR["z"]
    arena.apply_input(p.id, controls(1, jumpPower=1))
    high = p.y
    for _ in range(30):
        arena.step(.05)
        high = max(high, p.y)
    assert high == pytest.approx(MIRADOR["h"]-MIRADOR["thickness"]-HEAD_CLEARANCE)
    assert p.grounded and p.y == 0


@pytest.mark.parametrize("shuttle_index", range(3))
def test_moving_platform_carries_a_grounded_player(shuttle_index):
    arena = Arena(seed=1, mode="race")
    p = arena.join("Prueba")
    arena.players = {p.id: p}
    def shuttle(tick):
        return [box for box, _, _ in boxes_at(tick) if box.get("motion")][shuttle_index]
    start = shuttle(0)
    p.x, p.y, p.z = start["x"], start["h"], start["z"]
    for _ in range(16):
        arena.step(.05)
    end = shuttle(16)
    assert p.grounded
    assert (p.x, p.y, p.z) == pytest.approx((end["x"], end["h"], end["z"]))
    assert (p.x, p.z) != (start["x"], start["z"])


def test_manual_jump_height_and_single_landing():
    heights = []
    for power in (None, 0, .5, 1):
        arena = Arena(seed=3, mode="race")
        p = arena.join("Prueba")
        arena.players = {p.id: p}
        arena.apply_input(p.id, controls(1, jumpPower=power))
        arena.apply_input(p.id, controls(2))
        arena.step(.05)
        jump_time = p.jumped_at
        height = p.y
        for tick in range(45):
            # A request released in the air must not produce a second jump on landing.
            arena.apply_input(p.id, controls(tick+3, jumpPower=1 if tick == 0 and power is not None else None))
            arena.step(.05)
            height = max(height, p.y)
        assert p.jumped_at == jump_time
        assert p.grounded and p.y == p.vy == 0
        heights.append(height)
    idle, tap, medium, full = heights
    assert idle == 0 < tap < medium < full
    assert tap < 1.35 < full


@pytest.mark.parametrize(("axis", "side"), [("x", -1), ("x", 1), ("z", -1), ("z", 1)])
def test_tower_can_be_climbed_from_each_entrance(axis, side):
    decks = {o["tier"]: o for o in CONFIG["obstacles"]
             if o.get("tier") and (o[axis]*side > 0 or o["tier"] == 3)}
    arena = Arena(seed=3, mode="race")
    p = arena.join("Saltador")
    arena.players = {p.id: p}
    first = decks[1]
    p.x = p.z = 0
    setattr(p, axis, first[axis]+side*(first["w" if axis == "x" else "d"]/2+1.6))
    for tier in (1, 2, 3):
        deck = decks[tier]
        start = (p.x, p.z)
        direction = dict(moveX=-side) if axis == "x" else dict(moveZ=-side)
        # Stand through the charge, then release Space once and steer toward the target.
        for _ in range(18):
            arena.apply_input(p.id, controls(p.controls.seq+1, **direction))
            arena.step(1/CONFIG["tickRate"])
        assert (p.x, p.z) == start
        for tick in range(40):
            steering = -side if (getattr(p, axis)-deck[axis])*side > .15 else 0
            arena.apply_input(p.id, controls(p.controls.seq+1, jumpPower=1 if tick == 0 else None,
                              moveX=steering if axis == "x" else 0, moveZ=steering if axis == "z" else 0))
            arena.step(1/CONFIG["tickRate"])
            if p.grounded and abs(getattr(p, axis)-deck[axis]) <= .36:
                break
        assert p.grounded and p.y == pytest.approx(deck["h"])
        assert arena.can_move(p.x, p.z, p.y)


def test_idle_human_does_not_cause_bots_to_eliminate_each_other():
    arena = Arena(seed=1, duration=35)
    human = arena.join("Prueba")
    for _ in range(700):
        arena.step(.05)
    bots = [p for p in arena.players.values() if p.bot]
    assert all(p.balloons.bit_count() == len(BALLOON_TARGETS) for p in bots)
    assert any(p.jumped_at > 0 for p in bots)
    assert any(p.last_throw_at > 0 for p in bots)
    assert human.balloons.bit_count() < len(BALLOON_TARGETS)
    assert all(math.isfinite(p.x+p.y+p.z) for p in arena.players.values())
