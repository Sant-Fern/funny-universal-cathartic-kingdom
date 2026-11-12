import json
import math
import subprocess
from pathlib import Path

import pytest

from server.app import Input
from server.game import Arena,Shot,BALLOON_TARGETS,CONFIG,TOWER_TRACKS,boxes_at,height_at,launch_velocity,throw_origin,balloon_offsets


def lone_arena():
    arena=Arena(seed=7, mode="race")
    player=arena.join("Botellas")
    arena.players={player.id:player}
    player.x,player.y,player.z=-18,5,-12
    return arena,player


@pytest.mark.parametrize('mode', ['race', 'eliminations'])
def test_near_miss_curves_into_rival_for_humans_but_bots_keep_their_misses(mode):
    for bot in (False, True):
        # Keep this aiming test's target at a fixed height.
        arena = Arena(seed=1, mode=mode, auto_bounce=False)
        shooter, victim = arena.join('Uno'), arena.join('Dos')
        arena.players = {p.id:p for p in (shooter,victim)}
        shooter.bot, shooter.next_think = bot, 100
        shooter.x, shooter.z, victim.x, victim.z = -18,-15,12,12
        arena.time = 5
        y = 3.05 if mode == 'eliminations' else 1.8
        shot = Shot(1,shooter.id,shooter.team,9,y,13,18,0,0,age=.2)
        arena.shots = [shot]
        for _ in range(18):
            arena.step(.05)
            if arena.impacts:
                break
        assert arena.impacts[0]['hits'] == int(not bot)
        assert (shot.assist_started >= 0) == (not bot)
        if mode == 'eliminations':
            assert victim.balloons.bit_count() == (3 if bot else 2)


@pytest.mark.parametrize('condition', ['cover','ally','behind','far','protected','eliminated'])
def test_assistance_respects_cover_and_target_eligibility(condition):
    arena = Arena(seed=1, mode='race')
    shooter, victim = arena.join('Uno'), arena.join('Dos')
    arena.players = {p.id:p for p in (shooter,victim)}
    arena.time = 5
    victim.x,victim.y,victim.z = 12,0,12
    shot = Shot(1,shooter.id,shooter.team,9.5,1.8,12.7,18,0,0,age=.2)
    boxes = ()
    if condition == 'cover':
        boxes = (({'x':11,'z':12,'w':.3,'d':5},0,5),)
    elif condition == 'ally':
        victim.team = shooter.team
    elif condition == 'behind':
        shot.vx = -18
    elif condition == 'far':
        victim.x = 20
    elif condition == 'protected':
        victim.protected_until = 10
    else:
        victim.health = 0
    arena.assist_shot(shot,.05,boxes)
    assert shot.assist_target is None


def test_ballistic_flight_matches_closed_form_at_multiple_ticks():
    arena,p=lone_arena()
    origin=(-18,8,-13)
    velocity=(5,10,3)
    arena.shots=[Shot(1,p.id,p.team,*origin,*velocity)]
    for _ in range(6): arena.step(.05)
    s=arena.shots[0]
    assert s.x==pytest.approx(origin[0]+velocity[0]*.3)
    assert s.y==pytest.approx(origin[1]+velocity[1]*.3-.5*CONFIG["shotGravity"]*.3**2)
    assert s.vy==pytest.approx(velocity[1]-CONFIG["shotGravity"]*.3)


def test_release_event_survives_a_newer_movement_packet_and_is_not_repeated():
    arena,p=lone_arena()
    def message(seq,fire,power=.8):
        return Input(type="input",seq=seq,moveX=0,moveZ=0,yaw=0,pitch=.1,fire=fire,power=power)
    arena.apply_input(p.id,message(1,True))
    arena.apply_input(p.id,message(2,False))
    arena.step(.05)
    assert arena.shot_id==1
    for _ in range(30):arena.step(.05)
    assert arena.shot_id==1


def test_bottle_breaks_on_ground_and_produces_one_impact():
    arena,p=lone_arena()
    x,z=-18,-12
    arena.shots=[Shot(1,p.id,p.team,x,height_at(x,z)+.2,z,0,-4,0)]
    arena.step(.05)
    assert not arena.shots
    assert len(arena.impacts)==1
    assert arena.impacts[0]["y"]==pytest.approx(height_at(x,z)+CONFIG["shotRadius"],abs=.003)
    arena.step(.05)
    assert not arena.impacts


def test_heavy_bottle_can_hit_several_enemies_but_cover_blocks_splash():
    arena = Arena(seed=7, mode="race", auto_bounce=False)
    shooter = arena.join("Lanzador")
    enemy = arena.join("Cerca")
    enemy_two = arena.players["slot-3"]
    shielded = arena.players["slot-5"]
    ally = arena.players["slot-2"]
    arena.players = {p.id:p for p in (shooter, enemy, enemy_two, shielded, ally)}
    for p, (x, z) in zip((enemy, enemy_two, shielded, ally),
                         ((1.2,-3.2),(.8,-2.7),(2.7,-.96),(1.7,-2.95))):
        p.bot = False
        p.x, p.y, p.z = x, 0, z
    arena.time = 2
    shot = Shot(1, shooter.id, shooter.team, 1.7, .7, -2.7, 0, 0, 10, kind="heavy")
    # Explicit cover isolates splash occlusion from the authored map layout.
    cover = (({'x':0,'z':0,'w':4.2,'d':4.2},0,5),)
    hits, downs = arena.burst(shot,(1.7,.7,-2.7),None,None,cover)
    assert hits == 2 and downs == 0
    assert all(p.health == 100 for p in arena.players.values())
    assert enemy.push_until > 2 and enemy_two.push_until > 2
    assert shielded.push_until == ally.push_until == 0
    victim_state = next(p for p in arena.snapshot()["players"] if p["id"] == enemy.id)
    assert victim_state["hitAt"] == pytest.approx(arena.time)
    assert victim_state["hitForce"] > 0 and victim_state["hitBy"] == shooter.id
    assert victim_state["hitYaw"] < 0  # the splash came from the victim's right


@pytest.mark.parametrize("steering", [0, 1])
def test_heavy_can_displace_a_defender_at_the_edge_but_steering_still_works(steering):
    arena = Arena(seed=3, mode="race")
    attacker, victim = arena.join("Atacante"), arena.join("Defensor")
    arena.players = {p.id: p for p in (attacker, victim)}
    deck = TOWER_TRACKS[0][0]
    victim.x, victim.y, victim.z = deck["x"]-deck["w"]/2+.39, deck["h"], deck["z"]
    start = victim.x
    arena.time = 2
    shot = Shot(1, attacker.id, attacker.team, start+.55, victim.y+.2, victim.z, 0, -2, 0, kind="heavy")
    arena.shots = [shot]
    arena.step(.05)
    assert victim.health == 100 and not victim.grounded
    assert victim.stunned_until > arena.time
    arena.apply_input(victim.id, Input(type="input",seq=0,moveX=steering,moveZ=0,yaw=0,pitch=0,fire=True))
    assert not victim.throw_requested
    for seq in range(1,46):
        arena.apply_input(victim.id, Input(type="input",seq=seq,moveX=steering,moveZ=0,yaw=0,pitch=0,fire=False))
        arena.step(.05)
        if victim.grounded:
            break
    if steering:
        assert victim.grounded and victim.y == deck["h"]
    else:
        assert victim.grounded and victim.y < deck["h"] and victim.x < start


def test_client_and_server_math_and_predicted_endpoint_agree():
    root=Path(__file__).parents[2]
    js='''import {heightAt,launchVelocity,throwOrigin,trajectory} from './shared/physics.js';
const samples=[[-18,-12,0,-.2,.25],[-15,-9,.5,.1,.7],[-17,0,Math.PI/2,.6,1],[-5.85,0,Math.PI/2,.64,.06,2.65],[-20,18,0,-.2,.55,0,'heavy']];
console.log(JSON.stringify(samples.map(([x,z,yaw,pitch,power,y=heightAt(x,z),kind='standard'])=>{const o=throwOrigin(x,y,z,yaw),v=launchVelocity(yaw,pitch,power,kind);return {height:y,origin:o,velocity:v,end:trajectory(o,v,kind).at(-1)}})));'''
    data=json.loads(subprocess.run(["node","--input-type=module","-e",js],cwd=root,check=True,capture_output=True,text=True).stdout)
    samples=[(-18,-12,0,-.2,.25,0,"standard"),(-15,-9,.5,.1,.7,0,"standard"),
             (-17,0,math.pi/2,.6,1,0,"standard"),(-5.85,0,math.pi/2,.64,.06,2.65,"standard"),
             (-20,18,0,-.2,.55,0,"heavy")]
    for values,result in zip(samples,data):
        x,z,yaw,pitch,power,y,kind=values
        arena,p=lone_arena()
        p.x,p.z,p.y,p.yaw=x,z,y,yaw
        origin=throw_origin(p)
        velocity=launch_velocity(yaw,pitch,power,kind)
        assert result["height"]==pytest.approx(p.y,abs=1e-10)
        assert list(result["origin"].values())==pytest.approx(origin)
        assert list(result["velocity"].values())==pytest.approx(velocity)
        arena.shots=[Shot(99,p.id,p.team,*origin,*velocity,kind=kind)]
        impact=None
        for _ in range(100):
            arena.step(.05)
            if arena.impacts:impact=arena.impacts[0];break
        assert impact is not None
        assert [impact[k] for k in ("x","y","z")]==pytest.approx([result["end"][k] for k in ("x","y","z")],abs=.004)


def test_moving_platform_can_sweep_into_a_shot_and_preview_agrees():
    arena, p = lone_arena()
    before = next(o for o, _, _ in boxes_at(0) if o.get("motion"))
    after = next(o for o, _, _ in boxes_at(1) if o.get("motion"))
    radius = CONFIG["shotRadius"]
    x = (before["x"]+after["x"])/2 + before["w"]/2 + radius
    origin = (x, before["h"]-.2, before["z"])
    arena.shots = [Shot(1, p.id, p.team, *origin, 0, 0, 0)]
    arena.step(.05)
    assert len(arena.impacts) == 1
    js = f"""import {{trajectory}} from './shared/physics.js';
const end=trajectory({json.dumps(dict(zip(('x','y','z'),origin)))},{{x:0,y:0,z:0}});
console.log(JSON.stringify(end.at(-1)));"""
    root = Path(__file__).parents[2]
    predicted = json.loads(subprocess.run(["node","--input-type=module","-e",js],
                           cwd=root,check=True,capture_output=True,text=True).stdout)
    assert [arena.impacts[0][k] for k in ("x","y","z")] == pytest.approx(list(predicted.values()),abs=.002)


@pytest.mark.parametrize("kind", ["standard", "heavy"])
def test_balloons_require_direct_contact_and_last_pop_disqualifies(kind):
    arena = Arena(seed=2)
    shooter, victim = arena.join("Lanzador"), arena.join("Objetivo")
    shooter.x, shooter.z = -12, -12
    victim.x, victim.z = 12, 12
    arena.players = {p.id: p for p in (shooter, victim)}
    arena.time = 4.5
    arena.shots = [Shot(1, shooter.id, None, victim.x, 1.65, victim.z, 0, 0, 0, kind=kind)]
    arena.step(.05)
    assert victim.balloons.bit_count() == 3
    assert victim.stunned_until > arena.time and not victim.grounded
    arena.shots.clear()
    for index in range(len(BALLOON_TARGETS)):
        victim.y, victim.vy, victim.grounded = 0, 0, True
        dx, dy, dz = balloon_offsets(victim)[index]
        arena.time = max(arena.time, victim.protected_until)
        arena.shots = [Shot(index+2, shooter.id, None, victim.x+dx, victim.y+dy, victim.z+dz, 0, 0, 0, kind=kind)]
        arena.step(.05)
        assert not victim.balloons & (1 << index)
        assert victim.balloons.bit_count() == 2-index
    assert victim.health == 0 and shooter.pops == 3
    assert arena.finished and arena.winner == shooter.id


def test_race_standard_bottle_pushes_without_damage():
    arena = Arena(seed=3, mode="race")
    shooter, victim = arena.join("Lanzador"), arena.join("Objetivo")
    arena.players = {p.id: p for p in (shooter, victim)}
    arena.time = 2
    victim.x, victim.z = 14, 12
    arena.shots = [Shot(1, shooter.id, shooter.team, 13, CONFIG["hitHeight"], 12, 15, 0, 0)]
    arena.step(.05)
    assert victim.health == 100 and victim.push_x > 0
    assert arena.impacts[0]["hits"] == 1 and arena.impacts[0]["downs"] == 0
