import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaObstacles,heightAt,launchVelocity,throwOrigin,trajectory,positionAt,config,pogoLaunch,pogoMomentum,segmentObstacle,obstacleAt} from '../../shared/physics.js';
import {towerTracks} from '../../shared/tower.js';

test('lean redirects spring force sideways and its impulse decays through flight',()=>{
  const upright=pogoLaunch(1),lean=pogoLaunch(1,1,0),diagonal=pogoLaunch(1,1,1);
  assert.equal(upright.vx,0);
  assert.ok(lean.vx>3&&lean.vy<upright.vy);
  assert.ok(Math.abs(Math.hypot(diagonal.vx,diagonal.vy,diagonal.vz)-config.jumpMaxSpeed)<1e-8);
  const later=pogoMomentum(lean.vx,lean.vz,.7);
  assert.ok(later.x>0&&later.x<lean.vx);
});
test('elliptical surfaces have curved projectile collision instead of solid square corners',()=>{
  const o=towerTracks[1].find(p=>p.style==='tea-tray'),box=obstacleAt(o,0),y=o.h-.5;
  const x=o.x+o.w*.49,z=o.z+o.d*.49;
  assert.equal(segmentObstacle({x,y,z},{x:x+.1,y,z:z+.1},o,box),null);
  assert.ok(Math.abs(segmentObstacle({x:o.x-o.w,y,z:o.z},{x:o.x+o.w,y,z:o.z},o,box)-.25)<1e-8);
});

test('power changes speed and distance; gravity produces a descending arc',()=>{
  const origin={x:-15,y:4,z:-10},low=launchVelocity(0,.1,.15),high=launchVelocity(0,.1,1);
  assert.ok(Math.hypot(high.x,high.y,high.z)>Math.hypot(low.x,low.y,low.z));
  const before=positionAt(origin,high,.5),after=positionAt(origin,high,1.5);
  assert.ok(before.y>origin.y);
  assert.ok(after.y<before.y);
});
test('bottles can fly underneath a suspended deck but stop against its side',()=>{
  const deck=towerTracks[0].find(p=>p.style==='book'), left=deck.x-deck.w/2-config.shotRadius;
  const underneath=trajectory({x:deck.x-5,y:1.8,z:deck.z},{x:30,y:0,z:0},'standard',0,[deck]).at(-1);
  assert.ok(underneath.x>deck.x+deck.w/2);
  const side=trajectory({x:deck.x-5,y:deck.h-deck.thickness/2,z:deck.z},{x:20,y:1,z:0},'standard',0,[deck]).at(-1);
  assert.ok(Math.abs(side.x-left)<.01);
});
test('guide lands on the same arena floor used by the player',()=>{
  const origin=throwOrigin(-15,heightAt(-15,-10),-10,0);
  const end=trajectory(origin,launchVelocity(0,-.2,.25),'standard',0,arenaObstacles('eliminations')).at(-1);
  assert.ok(Math.abs(end.y-config.shotRadius-heightAt(end.x,end.z))<.02);
});
test('maximum power and extreme camera pitch stay finite and inside the arena',()=>{
  for(const pitch of [-.65,0,.64]){
    const points=trajectory(throwOrigin(-17,heightAt(-17,0),0,Math.PI/2),launchVelocity(Math.PI/2,pitch,1));
    assert.ok(points.length>1);
    assert.ok(points.every(p=>Number.isFinite(p.x+p.y+p.z)));
    assert.ok(Math.abs(points.at(-1).x)<=config.width/2+.001);
  }
});
