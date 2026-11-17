import json
import math
import subprocess
from pathlib import Path

import pytest

from server.game import Arena, CONFIG, pogo_launch
from server.tests.test_game import controls


def planted_player():
    # Isolate launch mechanics from the continuous bounce cycle.
    arena = Arena(seed=11, mode='race', auto_bounce=False)
    p = arena.join('Equilibrio')
    arena.players = {p.id: p}
    p.x, p.y, p.z = -25, 0, -21
    return arena, p


def jump_with_lean(direction):
    arena, p = planted_player()
    for seq in range(16):
        arena.apply_input(p.id, controls(seq, moveX=direction))
        arena.step(.05)
    origin = p.x
    assert p.grounded and origin == -25
    arena.apply_input(p.id, controls(16, jumpPower=1))
    arena.apply_input(p.id, controls(17))
    apex = 0
    for _ in range(30):
        arena.step(.05)
        apex = max(apex, p.y)
        if p.grounded:
            break
    assert p.grounded and p.y == 0
    assert p.launch_x == p.launch_z == 0
    return p.x-origin, apex


def test_ground_lean_creates_persistent_directional_impulse_and_lowers_apex():
    straight_distance, straight_apex = jump_with_lean(0)
    right_distance, leaned_apex = jump_with_lean(1)
    left_distance, _ = jump_with_lean(-1)
    assert straight_distance == 0
    assert right_distance > 1 and left_distance < -1
    assert leaned_apex < straight_apex
    assert right_distance == pytest.approx(-left_distance)


def test_release_captures_lean_even_when_newer_packet_reverses_input():
    arena, p = planted_player()
    for seq in range(10):
        arena.apply_input(p.id, controls(seq, moveX=1))
        arena.step(.05)
    lean = p.lean_x
    arena.apply_input(p.id, controls(10, jumpPower=1, moveX=1))
    arena.apply_input(p.id, controls(11, moveX=-1))
    arena.step(.05)
    expected = pogo_launch(1, lean, 0)
    assert p.launch_x == pytest.approx(expected[0]) and p.launch_x > 0
    assert p.vy == pytest.approx(expected[1]-CONFIG['gravity']*.05)
    row = arena.snapshot()['players'][0]
    assert row['launchX'] > 0 and row['leanX'] > 0


def test_diagonal_and_oversized_lean_do_not_increase_total_spring_energy():
    for direction in [(1, 0), (1, 1), (100, -100)]:
        velocity = pogo_launch(1, *direction)
        assert math.hypot(*velocity) == pytest.approx(CONFIG['jumpMaxSpeed'])
        assert velocity[1] >= CONFIG['jumpMaxSpeed']*math.cos(CONFIG['pogo']['maxLeanAngle'])-1e-8


@pytest.mark.parametrize('mode', ['race', 'eliminations'])
@pytest.mark.parametrize('first_kind', ['standard', 'heavy'])
def test_both_bottles_have_two_second_shared_cooldown_without_queued_shots(mode, first_kind):
    arena = Arena(seed=11, mode=mode)
    p = arena.join('Recarga')
    rival = arena.join('Otro')
    arena.players = {player.id: player for player in (p, rival)}
    p.x, p.z, rival.x, rival.z = -25, -21, 25, 21
    arena.apply_input(p.id, controls(0, fire=True, bottle=first_kind))
    arena.step(.05)
    ready = p.next_shot
    assert ready-arena.time == pytest.approx(2)
    other_kind = 'heavy' if first_kind == 'standard' else 'standard'
    for seq in range(1,40):
        arena.apply_input(p.id, controls(seq, fire=True, bottle=other_kind))
        arena.step(.05)
        assert arena.shot_id == 1
    arena.step(.05)  # Cooldown expired, but blocked clicks must not fire later.
    assert arena.shot_id == 1
    arena.apply_input(p.id, controls(40, fire=True, bottle=other_kind))
    arena.step(.05)
    assert arena.shot_id == 2 and p.next_shot-arena.time == pytest.approx(2)


def test_javascript_and_python_share_pogo_impulse_math():
    samples = [[1,0,0],[1,1,0],[.5,.4,-.7],[1,1,1],[0,0,-1]]
    source = "import {pogoLaunch} from './shared/physics.js'; console.log(JSON.stringify("+json.dumps(samples)+".map(args=>pogoLaunch(...args))));"
    result = subprocess.run(['node','--input-type=module','-e',source],cwd=Path(__file__).parents[2],check=True,capture_output=True,text=True)
    for sample, velocity in zip(samples, json.loads(result.stdout)):
        assert (velocity['vx'],velocity['vy'],velocity['vz']) == pytest.approx(pogo_launch(*sample))
