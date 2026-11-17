import pytest

from server.game import Arena, RACE, SUMMIT, Shot
from server.tests.test_game import controls


def arrive(arena, player):
    player.x, player.y, player.z = SUMMIT['x'], SUMMIT['h'], SUMMIT['z']
    player.grounded = True
    arena.check_finish()


def test_every_place_scores_and_team_sum_can_beat_first_finisher():
    arena = Arena(mode='race')
    arena.join('Primero')
    players = list(arena.players.values())
    # Menta takes first, Coral takes 2nd through 6th and wins on the sum.
    order = [players[0], *[p for p in players if p.team == 1], *[p for p in players[2:] if p.team == 0]]
    for position, player in enumerate(order, 1):
        arena.time = position*15
        arrive(arena, player)
        assert player.finish_position == position
        assert player.race_points == RACE['placementPoints'][position-1]
        assert arena.finished == (position == 10)
        # Polling the finish again must never award the same slot twice.
        score = arena.score.copy()
        arena.check_finish()
        assert arena.score == score
    assert arena.score == [20, 35] and arena.winner == 1
    snapshot = arena.snapshot()
    assert sum(snapshot['score']) == 55
    assert all(p['finishTime'] is not None for p in snapshot['players'])
    assert [p['racePoints'] for p in snapshot['players']] == [p.race_points for p in players]


def test_timeout_uses_only_points_from_arrivals_and_marks_nonfinishers():
    arena = Arena(mode='race')
    p = arena.join('Corredor')
    arena.time = 180
    arrive(arena, p)
    other = arena.players['slot-1']
    other.y, other.best_height = SUMMIT['h']-1, SUMMIT['h']-1
    arena.time = arena.duration
    arena.check_finish()
    assert arena.finished and arena.winner == 0 and arena.score == [10, 0]
    assert other.race_points == 0 and other.finish_position is other.finish_time is None


def test_same_tick_arrivals_share_place_points_and_skip_occupied_places():
    arena = Arena(mode='race')
    mint, coral = list(arena.players.values())[:2]
    arena.time = 120
    for player in (coral, mint):
        player.x, player.y, player.z = 0, SUMMIT['h'], 0
    arena.check_finish()
    assert mint.finish_position == coral.finish_position == 1
    assert arena.score == [10, 10]
    third = arena.players['slot-2']
    arena.time += .05
    arrive(arena, third)
    assert third.finish_position == 3 and third.race_points == 8


@pytest.mark.parametrize('arrivals', [False, True])
def test_team_point_tie_has_no_height_tiebreaker(arrivals):
    arena = Arena(mode='race')
    if arrivals:
        for player in list(arena.players.values())[:2]:
            player.x, player.y, player.z = 0, SUMMIT['h'], 0
    arena.players['slot-2'].best_height = 150
    arena.time = arena.duration
    arena.check_finish()
    assert arena.finished and arena.winner is None
    assert arena.score == ([10, 10] if arrivals else [0, 0])


def test_finishers_freeze_ignore_input_and_do_not_block_or_take_hits():
    arena = Arena(mode='race')
    p = arena.join('Llegué')
    arena.time = 150
    arrive(arena, p)
    before = (p.x, p.y, p.z, p.race_points, p.finish_time)
    arena.apply_input(p.id, controls(99, jumpPower=1, fire=True, moveX=1))
    assert p.controls.seq == -1 and p.jump_requested is None and not p.throw_requested
    rival = arena.players['slot-1']
    assert not arena.is_opponent(p, rival.id, rival.team)
    assert not arena.shove(p, rival, 0, 1)
    rival.bot = False
    rival.x, rival.y, rival.z = p.x, p.y+.2, p.z
    rival.grounded, rival.vy = False,-1
    for _ in range(10):
        arena.step(.05)
        if rival.finish_position is not None:
            break
    assert (p.x, p.y, p.z, p.race_points, p.finish_time) == before
    assert rival.finish_position == 2  # The first arrival did not block the ring.


def test_finish_records_attribution_and_removes_pending_projectiles():
    arena = Arena(mode='race')
    p = arena.join('Aporte original')
    arena.shots.append(Shot(1, p.id, p.team, 0, 2, 0, 1, 1, 1))
    arrive(arena, p)
    assert not arena.shots
    arena.leave(p.id)
    arena.join('Relevo', slot_id=p.id)
    row = next(row for row in arena.snapshot()['players'] if row['id'] == p.id)
    assert row['finishName'] == 'Aporte original' and row['finishBot'] is False
    assert row['racePoints'] == 10
