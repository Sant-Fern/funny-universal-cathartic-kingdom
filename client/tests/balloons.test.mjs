import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createPogoStance } from '../src/characters.js';
import { config,pogoStanceAngles,balloonOffsets } from '../../shared/physics.js';

test('rendered balloon anchors match the tilted hit targets at every facing',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),root=new TransformNode('player',scene);
  const stance=createPogoStance(root);
  const targets=config.balloons.targets.map(offset=>{
    const balloon=new TransformNode('balloon',scene);balloon.parent=stance;balloon.position.set(...offset);return balloon;
  });
  try{
    for(const grounded of [true,false])for(const yaw of [0,.7,Math.PI,-2.6])for(const [leanX,leanZ] of [[0,0],[1,0],[-1,0],[.7,-.6],[1,1]]){
      const p={yaw,leanX,leanZ,grounded},{pitch,roll}=pogoStanceAngles(p);
      root.position.set(12,5,-8);root.rotation.y=yaw;stance.rotation.set(pitch,0,roll);
      const expected=balloonOffsets(p);
      targets.forEach((balloon,i)=>{
        balloon.computeWorldMatrix(true);
        const actual=balloon.getAbsolutePosition().subtract(root.position).asArray();
        actual.forEach((value,axis)=>assert.ok(Math.abs(value-expected[i][axis])<1e-5,`${yaw}, ${leanX}, ${leanZ}, ${axis}`));
      });
    }
  }finally{scene.dispose();engine.dispose();}
});

test('lean moves balloons with their anchor and returns to the upright layout',()=>{
  const upright=balloonOffsets({yaw:0,grounded:true});
  const right=balloonOffsets({yaw:0,grounded:true,leanX:1}),left=balloonOffsets({yaw:0,grounded:true,leanX:-1});
  for(let i=0;i<upright.length;i++){
    assert.ok(right[i][0]>upright[i][0]+.8);
    assert.ok(left[i][0]<upright[i][0]-.8);
    upright[i].forEach((value,axis)=>assert.ok(Math.abs(value-config.balloons.targets[i][axis])<1e-8));
  }
});
