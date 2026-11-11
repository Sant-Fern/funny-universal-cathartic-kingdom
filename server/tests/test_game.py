import math

import pytest

from server.app import Input
from server.game import (
    Arena, BALLOON_TARGETS, CONFIG, HEAD_CLEARANCE, SUMMIT, TOWER_ENTRIES, TOWER_TRACKS,
    boxes_at, overlaps, segment_box, segment_sphere, steer_to,
)


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


def test_bots_split_across_both_tower_entrances():
    arena = Arena(seed=1,mode='race')
    arena.join('Prueba')
    routes = {0:set(),1:set()}
    for _ in range(1000):
        arena.step(.05)
        for p in arena.players.values():
            if p.bot and p.grounded and abs(p.y-CONFIG['race']['entry']['h']) < .01:
                routes[p.team].add(p.x > 0)
    assert routes == {0:{False,True},1:{False,True}}


def test_ground_direction_carries_into_the_jump_after_the_key_is_released():
    arena = Arena(seed=2, mode="race")
    p = arena.join("Prueba")
    arena.players = {p.id: p}
    start = p.x
    arena.apply_input(p.id, controls(1, moveX=1))
    arena.step(.05)
    assert p.x == start and p.grounded
    arena.apply_input(p.id, controls(2, moveX=1, jumpPower=1))
    arena.apply_input(p.id, controls(3))
    arena.step(.05)
    assert p.x > start and not p.grounded


@pytest.mark.parametrize("height_gap", [0, 3])
def test_players_cannot_jump_through_each_other_at_the_same_height(height_gap):
    arena = Arena(seed=2)
    a, b = arena.join("Uno"), arena.join("Dos")
    arena.players = {p.id: p for p in (a, b)}
    for p, x, y in ((a,-13.7,5),(b,-12.3,5+height_gap)):
        p.x, p.y, p.z, p.grounded = x, y, 12, False
    for seq in range(5):
        arena.apply_input(a.id, controls(seq, moveX=1))
        arena.apply_input(b.id, controls(seq, moveX=-1))
        arena.step(.05)
    if height_gap:
        assert a.x > b.x
    else:
        assert b.x-a.x == pytest.approx(2*CONFIG["playerRadius"])


def test_collisions_boundaries_and_obstacle():
    arena = Arena(mode="race")
    assert not arena.can_move(CONFIG["width"]/2, 0, 0)
    assert arena.can_move(20, 0, 0)
    assert not arena.can_move(0, 0, 4)
    assert arena.can_move(0, 0, SUMMIT["h"]+2)
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
    assert flat.can_move(0, 0, 4)
    assert not tower.can_move(0, 0, 4)


def test_all_elimination_spawns_clear_the_new_stages_and_each_other():
    arena = Arena()
    players = list(arena.players.values())
    for i, player in enumerate(players):
        assert arena.can_move(player.x, player.z, player.y)
        assert all(math.hypot(player.x-other.x, player.z-other.z) > 2*CONFIG['playerRadius']
                   for other in players[i+1:])


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
    for _ in range(round(arena.duration/.05)):
        arena.step(.05)
        if arena.finished:
            break
    assert arena.finished and max(arena.score) == SUMMIT["h"]
    assert 120 <= arena.time < arena.duration
    assert all(p.health == 100 for p in arena.players.values())


def test_pogo_cannot_pass_upward_through_a_suspended_deck():
    arena = Arena(seed=1, mode="race")
    p = arena.join("Prueba")
    arena.players = {p.id: p}
    deck = TOWER_TRACKS[0][1]
    p.x, p.z = deck["x"], deck["z"]
    arena.apply_input(p.id, controls(1, jumpPower=1))
    high = p.y
    for _ in range(30):
        arena.step(.05)
        high = max(high, p.y)
    assert high == pytest.approx(deck["h"]-deck["thickness"]-HEAD_CLEARANCE)
    assert p.grounded and p.y == 0


@pytest.mark.parametrize("shuttle_index", [0, 4])
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


@pytest.mark.parametrize("team", [0, 1])
def test_complete_tower_routes_take_at_least_two_minutes(team):
    arena = Arena(seed=3, mode="race")
    if team == 1:
        arena.join("Menta")
    p = arena.join("Saltador")
    arena.players = {p.id: p}
    dt = 1/CONFIG["tickRate"]
    for deck in [TOWER_ENTRIES[team], *TOWER_TRACKS[team], SUMMIT]:
        last_landing = p.landed_at
        for tick in range(60):
            dx, dz = steer_to(p.x, p.z, (deck["x"], deck["z"]), dt)
            arena.apply_input(p.id, controls(p.controls.seq+1, jumpPower=1 if tick == 0 else None,
                                             moveX=dx, moveZ=dz))
            arena.step(dt)
            if p.grounded and p.landed_at > last_landing:
                break
        assert p.grounded and p.y == pytest.approx(deck["h"])
        assert overlaps(deck, p.x, p.z)
    assert arena.finished and arena.winner == team
    assert 120 <= arena.time < arena.duration


def test_bots_attack_each_other_with_an_idle_human():
    arena = Arena(seed=1, duration=45)
    human = arena.join("Prueba")
    bots = [p for p in arena.players.values() if p.bot]
    for _ in range(900):
        arena.step(.05)
        if sum(p.health > 0 for p in bots) > 5:
            assert sum(p.bot_target == human.id and p.bot_target_until > arena.time for p in bots) <= 2
    assert any(p.balloons.bit_count() < len(BALLOON_TARGETS) for p in bots)
    assert any(p.pops > 0 for p in bots)
    assert any(p.jumped_at > 0 for p in bots)
    assert any(p.last_throw_at > 0 for p in bots)
    assert all(math.isfinite(p.x+p.y+p.z) for p in arena.players.values())


def test_bot_deliberately_misses_a_rival_with_one_balloon(monkeypatch):
    arena = Arena(seed=1)
    human = arena.join("Prueba")
    bot = arena.players["slot-1"]
    arena.players = {p.id: p for p in (human, bot)}
    bot.x, bot.z = -12, -10
    human.x, human.z = -12, 0
    arena.time = 5
    bot.next_bot_jump = 100
    monkeypatch.setattr(arena.rng, "uniform", lambda a, b: (a+b)/2)
    monkeypatch.setattr(arena.rng, "random", lambda: .5)
    arena.think(bot)
    accurate_yaw = bot.controls.yaw
    human.balloons = 1 << (len(BALLOON_TARGETS)-1)
    arena.think(bot)
    assert bot.controls.fire
    assert abs(bot.controls.yaw-accurate_yaw) >= .22
