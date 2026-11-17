import json
import math
import subprocess
from pathlib import Path

import pytest

from server.game import Arena,Player,Shot,CONFIG,PLAYER_DIAMETER,balloon_offsets,pogo_launch,resolve_players
from server.tests.test_game import controls


def jump_collision(mode, power):
    arena=Arena(seed=3,mode=mode,auto_bounce=False)
    a,b=arena.join('Salta'),arena.join('Recibe')
    arena.players={p.id:p for p in (a,b)}
    a.x,a.y,a.z,a.grounded=-23.35,.2,-18,False
    b.x,b.y,b.z=-22,0,-18
    a.launch_x,a.vy,a.launch_z=pogo_launch(power,1,0)
    a.launch_speed=math.hypot(a.launch_x,a.vy,a.launch_z)
    a.jumped_at=arena.time
    arena.apply_input(a.id,controls(moveX=1))
    arena.step(.05)
    return arena,a,b


@pytest.mark.parametrize('mode',['eliminations','race'])
def test_charged_jump_pushes_further_than_normal_bounce_in_both_modes(mode):
    results=[]
    for power in [CONFIG['pogo']['bouncePower'],1]:
        arena,a,b=jump_collision(mode,power)
        assert a.collision_x<0<b.collision_x
        assert not b.grounded and b.vy>0
        assert b.health==100 and b.balloons.bit_count()==3 and a.pops==b.pops==0
        assert a.stunned_until==b.stunned_until==0
        speed=b.collision_x
        a.controls.move_x=0
        for _ in range(10):arena.step(.05)
        results.append((speed,b.x+22))
    assert results[1][0]>results[0][0]*1.2
    assert results[1][1]>results[0][1]*1.2


def contact_pair():
    a,b=Player('a','Uno',0),Player('b','Dos',1)
    a.x,a.y,a.z,a.grounded=0,6,-18,False
    b.x,b.y,b.z,b.grounded=.8,6,-18,False
    return a,b


def test_stronger_jumper_receives_less_recoil_in_a_head_on_collision():
    a,b=contact_pair()
    a.launch_speed=CONFIG['jumpMaxSpeed']
    b.launch_speed=math.hypot(*pogo_launch(CONFIG['pogo']['bouncePower']))
    previous={a.id:(-.4,6,-18),b.id:(1.2,6,-18)}
    resolve_players([a,b],previous,(),dt=.05,time=2)
    assert a.collision_x<0<b.collision_x
    assert b.collision_x>abs(a.collision_x)
    assert b.x-a.x==pytest.approx(PLAYER_DIAMETER)


def test_resting_contact_does_not_invent_momentum_and_continued_contact_does_not_stack():
    a,b=contact_pair()
    previous={p.id:(p.x,p.y,p.z) for p in (a,b)}
    contacts=resolve_players([a,b],previous,(),time=2)
    assert a.collision_x==b.collision_x==0
    # A fresh approaching contact does produce an impulse.
    a.x,b.x=0,.8
    previous={a.id:(-.4,6,-18),b.id:(.8,6,-18)}
    contacts=resolve_players([a,b],previous,(),time=2)
    speed,expiry=b.collision_x,b.collision_until
    assert speed>0
    a.x,b.x=0,.8
    resolve_players([a,b],previous,(),time=2.05,contacts=contacts)
    assert b.collision_x==speed and b.collision_until==expiry
    assert b.collision_x<=CONFIG['playerCollision']['maxPushSpeed']


def test_different_heights_and_departing_bodies_do_not_collide():
    a,b=contact_pair()
    b.y+=3
    previous={a.id:(-.4,6,-18),b.id:(1.2,9,-18)}
    assert not resolve_players([a,b],previous,(),time=2)
    assert a.collision_until==b.collision_until==0
    b.y=6
    a.x,b.x=-1,1
    previous={a.id:(-.55,6,-18),b.id:(.55,6,-18)}
    assert not resolve_players([a,b],previous,(),time=2)
    assert a.collision_until==b.collision_until==0


@pytest.mark.parametrize('mode',['eliminations','race'])
def test_collision_momentum_decays_and_respects_walls_and_arena_bounds(mode):
    arena,a,b=jump_collision(mode,1)
    b.x=CONFIG['width']/2-CONFIG['playerRadius']-.02 if mode=='eliminations' else CONFIG['race']['bounds']['width']/2-CONFIG['playerRadius']-.02
    a.x=-25
    edge=b.x+.02
    for _ in range(14):
        arena.step(.05)
        assert b.x<=edge+1e-8
    assert arena.time>b.collision_until
    stopped=b.x
    for _ in range(5):arena.step(.05)
    assert b.x==stopped


def test_javascript_and_server_share_balloon_hit_positions_for_lean_and_facing():
    samples=[{'yaw':yaw,'leanX':x,'leanZ':z,'grounded':grounded}
             for yaw in [0,.7,-2.2] for x,z in [(0,0),(1,0),(-.7,.6)] for grounded in [True,False]]
    source="import {balloonOffsets} from './shared/physics.js'; console.log(JSON.stringify("+json.dumps(samples)+".map(balloonOffsets)));"
    output=subprocess.run(['node','--input-type=module','-e',source],cwd=Path(__file__).parents[2],check=True,capture_output=True,text=True)
    for sample,offsets in zip(samples,json.loads(output.stdout)):
        p=Player('a','Prueba',None,yaw=sample['yaw'],lean_x=sample['leanX'],lean_z=sample['leanZ'],grounded=sample['grounded'])
        for expected,actual in zip(offsets,balloon_offsets(p)):
            assert actual==pytest.approx(expected)


@pytest.mark.parametrize('aim_at_tilted_balloon',[True,False])
def test_bottles_hit_the_tilted_balloon_instead_of_its_old_upright_location(aim_at_tilted_balloon):
    arena=Arena(seed=3,auto_bounce=False)
    shooter,victim=arena.join('Lanza'),arena.join('Inclina')
    arena.players={p.id:p for p in (shooter,victim)}
    shooter.x,shooter.z=-12,-12
    victim.x,victim.y,victim.z,victim.yaw=12,0,12,0
    victim.lean_x=1
    victim.protected_until=0
    arena.time=5
    arena.apply_input(victim.id,controls(moveX=1))
    offset=balloon_offsets(victim)[0] if aim_at_tilted_balloon else CONFIG['balloons']['targets'][0]
    arena.shots=[Shot(1,shooter.id,None,victim.x+offset[0],offset[1],victim.z+offset[2],0,0,0)]
    arena.step(.05)
    assert victim.balloons.bit_count()==(2 if aim_at_tilted_balloon else 3)
    assert shooter.pops==int(aim_at_tilted_balloon)


@pytest.mark.parametrize('inactive',['eliminated','finished'])
def test_eliminated_and_finished_players_cannot_receive_or_cause_body_impulses(inactive):
    arena,a,b=jump_collision('race',1)
    a.collision_x=b.collision_x=0
    a.collision_until=b.collision_until=0
    a.x,b.x=-23.2,-22
    if inactive=='eliminated':b.health=0
    else:b.finish_position=1
    arena.step(.05)
    assert a.collision_until==b.collision_until==0
