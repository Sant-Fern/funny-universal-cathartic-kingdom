import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaObstacles,heightAt,launchVelocity,throwOrigin,trajectory,positionAt,config} from '../../shared/physics.js';
import {towerTracks} from '../../shared/tower.js';

test('power changes speed and distance; gravity produces a descending arc',()=>{
  const origin={x:-15,y:4,z:-10},low=launchVelocity(0,.1,.15),high=launchVelocity(0,.1,1);
  assert.ok(Math.hypot(high.x,high.y,high.z)>Math.hypot(low.x,low.y,low.z));
  const before=positionAt(origin,high,.5),after=positionAt(origin,high,1.5);
  assert.ok(before.y>origin.y);
  assert.ok(after.y<before.y);
});
test('bottles can fly underneath a suspended deck but stop against its side',()=>{
  const deck=towerTracks[0][3], left=deck.x-deck.w/2-config.shotRadius;
  const underneath=trajectory({x:deck.x-5,y:1.8,z:deck.z},{x:20,y:0,z:0},'standard',0,[deck]).at(-1);
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
