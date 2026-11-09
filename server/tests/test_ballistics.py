import json
import math
import subprocess
from pathlib import Path

import pytest

from server.app import Input
from server.game import Arena,Shot,CONFIG,SUMMIT,boxes_at,height_at,launch_velocity,throw_origin


def lone_arena():
    arena=Arena(seed=7)
    player=arena.join("Botellas")
    arena.players={player.id:player}
    player.x,player.y,player.z=-18,5,-12
    return arena,player


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
    arena = Arena(seed=7)
    shooter = arena.join("Lanzador")
    enemy = arena.join("Cerca")
    enemy_two = arena.players["slot-3"]
    shielded = arena.players["slot-5"]
    ally = arena.players["slot-2"]
    arena.players = {p.id:p for p in (shooter, enemy, enemy_two, shielded, ally)}
    for p, (x, z) in zip((enemy, enemy_two, shielded, ally),
                         ((4.65,-9.0),(5.2,-10.7),(6.95,-10.75),(4.9,-9.7))):
        p.bot = False
        p.x, p.y, p.z = x, 0, z
    enemy.health = 20
    arena.time = 2
    arena.shots = [Shot(1, shooter.id, shooter.team, 5.4, .7, -9.25, 8, 0, 0, kind="heavy")]
    arena.step(.05)
    assert arena.impacts[0]["kind"] == "heavy"
    assert arena.impacts[0]["owner"] == shooter.id
    assert arena.impacts[0]["hits"] == 2
    assert arena.impacts[0]["downs"] == 1
    assert enemy.health == 0 and enemy_two.health < 100
    assert shielded.health == ally.health == 100
    victim_state = next(p for p in arena.snapshot()["players"] if p["id"] == enemy.id)
    assert victim_state["hitAt"] == pytest.approx(arena.time)
    assert victim_state["hitForce"] > 0 and victim_state["hitBy"] == shooter.id
    assert victim_state["hitYaw"] < 0  # the splash came from the victim's right


@pytest.mark.parametrize("steering", [0, 1])
def test_heavy_can_displace_a_defender_at_the_edge_but_steering_still_works(steering):
    arena = Arena(seed=3)
    attacker, victim = arena.join("Atacante"), arena.join("Defensor")
    arena.players = {p.id: p for p in (attacker, victim)}
    victim.x, victim.y, victim.z = SUMMIT["x"]-SUMMIT["w"]/2+.39, SUMMIT["h"], SUMMIT["z"]
    start = victim.x
    arena.time = 2
    shot = Shot(1, attacker.id, attacker.team, start+.55, victim.y+.2, victim.z, 0, -2, 0, kind="heavy")
    arena.shots = [shot]
    arena.step(.05)
    assert 0 < victim.health < 100 and not victim.grounded
    for seq in range(45):
        arena.apply_input(victim.id, Input(type="input",seq=seq,moveX=steering,moveZ=0,yaw=0,pitch=0,fire=False))
        arena.step(.05)
        if victim.grounded:
            break
    if steering:
        assert victim.grounded and victim.y == SUMMIT["h"] and victim.x > start
    else:
        assert victim.grounded and victim.y < SUMMIT["h"] and victim.x < start


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
        if y:
            # The throw from the intermediate ledge must land on the upper deck.
            assert impact["y"] == pytest.approx(CONFIG["obstacles"][0]["h"]+CONFIG["shotRadius"], abs=.002)


def test_moving_platform_can_sweep_into_a_shot_and_preview_agrees():
    arena, p = lone_arena()
    before = next(o for o, _, _ in boxes_at(0) if o.get("route") == "shuttle")
    after = next(o for o, _, _ in boxes_at(1) if o.get("route") == "shuttle")
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
