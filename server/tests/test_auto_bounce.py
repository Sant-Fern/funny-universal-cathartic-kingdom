import pytest

from server.game import Arena, CONFIG, jump_speed
from server.tests.test_game import controls


def bouncing_player(mode='race'):
    arena = Arena(seed=4, mode=mode)
    p = arena.join('Rebote')
    other = arena.join('Otro')
    arena.players = {player.id:player for player in (p,other)}
    p.x, p.y, p.z = -27, 0, -23
    other.x, other.y, other.z = 27, 0, 23
    other.bot = False
    return arena,p


@pytest.mark.parametrize('mode', ['race','eliminations'])
def test_no_input_keeps_bouncing_after_every_landing(mode):
    arena,p = bouncing_player(mode)
    jumps = set()
    for _ in range(100):
        arena.step(.05)
        if p.jumped_at > 0:
            jumps.add(p.jumped_at)
    assert len(jumps) >= 5
    assert (p.x,p.z) == (-27,-23)
    assert p.health == 100


def test_boost_released_in_air_is_used_once_at_next_landing():
    arena,p = bouncing_player()
    arena.step(.05)
    first = p.jumped_at
    assert not p.grounded
    arena.apply_input(p.id,controls(0,jumpPower=1))
    arena.apply_input(p.id,controls(1))
    assert p.jump_requested is not None
    for _ in range(40):
        arena.step(.05)
        if p.jumped_at > first:
            break
    assert p.jumped_at > first
    assert p.vy == pytest.approx(CONFIG['jumpMaxSpeed']-CONFIG['gravity']*.05)
    assert p.jump_requested is None
    boosted = p.jumped_at
    for _ in range(50):
        arena.step(.05)
        if p.jumped_at > boosted:
            break
    assert p.jumped_at > boosted
    assert p.vy == pytest.approx(jump_speed(CONFIG['pogo']['bouncePower'])-CONFIG['gravity']*.05)


def test_stun_delays_bounce_and_expired_boost_does_not_fire_later():
    arena,p = bouncing_player()
    p.stunned_until = 1
    for _ in range(15):
        arena.step(.05)
        assert p.grounded and p.jumped_at < 0
    for _ in range(8):
        arena.step(.05)
    assert p.jumped_at >= 1

    # A release four seconds before contact cannot remain queued indefinitely.
    p.x,p.y,p.z,p.vy,p.grounded = -104,200,-84,0,False
    arena.apply_input(p.id,controls(10,jumpPower=1))
    prior=p.jumped_at
    for _ in range(110):
        arena.step(.05)
        if p.jumped_at > prior:
            break
    assert p.jump_requested is None
    assert p.vy == pytest.approx(jump_speed(CONFIG['pogo']['bouncePower'])-CONFIG['gravity']*.05)


def test_finish_and_round_end_stop_automatic_bouncing():
    arena,p = bouncing_player()
    p.finish_position = 1
    arena.step(.05)
    assert p.grounded and p.jumped_at < 0
    arena.finish_round()
    snapshot = arena.snapshot()
    arena.step(5)
    assert arena.snapshot() == snapshot


def test_holding_space_plants_on_contact_until_release_then_jumps_stronger():
    arena,p=bouncing_player()
    arena.step(.05)
    first=p.jumped_at
    for seq in range(50):
        arena.apply_input(p.id,controls(seq,jumpHeld=True))
        arena.step(.05)
    assert p.grounded and p.y==0 and p.jumped_at==first
    assert arena.snapshot()['players'][0]['chargingJump'] is True
    arena.apply_input(p.id,controls(50,jumpHeld=False,jumpPower=1))
    arena.step(.05)
    assert not p.grounded
    assert p.vy==pytest.approx(CONFIG['jumpMaxSpeed']-CONFIG['gravity']*.05)
    assert p.vy>jump_speed(CONFIG['pogo']['bouncePower'])


def test_lost_space_release_times_out_instead_of_trapping_player():
    arena,p=bouncing_player()
    arena.apply_input(p.id,controls(0,jumpHeld=True))
    for _ in range(8):arena.step(.05)
    assert p.grounded
    for _ in range(8):arena.step(.05)
    assert p.jumped_at>0
