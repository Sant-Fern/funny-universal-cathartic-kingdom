import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createSkyCourse } from '../src/sky-course.js';
import { towerTracks } from '../../shared/tower.js';

test('race scenery builds finite geometry, animates and supports both quality settings',()=>{
  const engine=new NullEngine();
  // NullEngine has no canvas. Texture drawing is omitted in this geometry smoke test.
  engine.createCanvas=(width,height)=>({width,height,getContext:()=>({
    fillRect(){},strokeRect(){},fillText(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){},createLinearGradient:()=>({addColorStop(){}}),
  })});
  const scene=new Scene(engine),materials=new Map();
  const material=(hex,glow=false)=>{
    const key=`${hex}:${glow}`;
    if(!materials.has(key)){
      const paint=new StandardMaterial(key,scene);paint.diffuseColor=Color3.FromHexString(hex);
      if(glow)paint.emissiveColor=paint.diffuseColor;
      materials.set(key,paint);
    }
    return materials.get(key);
  };
  const solidSurfaces=new Map();
  const capture=mesh=>{
    const pad=mesh.metadata?.courseSurface;if(!pad)return;
    const key=`${pad.lane}-${pad.step}`;if(solidSurfaces.has(key))return;
    mesh.computeWorldMatrix(true);
    const bounds=mesh.getBoundingInfo().boundingBox;
    solidSurfaces.set(key,{shape:pad.shape,min:bounds.minimumWorld.asArray(),max:bounds.maximumWorld.asArray()});
  };
  scene.onMeshRemovedObservable.add(capture);
  const box=(name,size,pos,hex,parent)=>{
    const mesh=MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);
    mesh.position.set(...pos);mesh.material=material(hex);mesh.parent=parent;return mesh;
  };
  try{
    const course=createSkyCourse({scene,material,box,shadow:{addShadowCaster(){}}});
    scene.meshes.forEach(capture);
    // Gameplay architecture must be rendered at exactly the server's dimensions,
    // rather than leaving the climb on unrelated platforms in front of scenery.
    assert.equal(solidSurfaces.size,240);
    for(const pad of towerTracks.flat()){
      const surface=solidSurfaces.get(`${pad.lane}-${pad.step}`);
      assert.ok(surface,`${pad.style} step ${pad.step}`);
      const expectedMin=[pad.x-pad.w/2,pad.h-pad.thickness,pad.z-pad.d/2],expectedMax=[pad.x+pad.w/2,pad.h,pad.z+pad.d/2];
      assert.equal(surface.shape,pad.shape??'box');
      surface.min.forEach((value,i)=>assert.ok(Math.abs(value-expectedMin[i])<.0001));
      surface.max.forEach((value,i)=>assert.ok(Math.abs(value-expectedMax[i])<.0001));
    }
    assert.equal(scene.transformNodes.filter(n=>n.name.startsWith('dream-sector-')).length,6);
    assert.ok(scene.meshes.length>50);
    for(const low of [false,true]){
      course.setLowQuality(low);
      course.onSnapshot({players:[{finishPosition:1}]});
      course.update(4,4,low,'race',65);
      for(const mesh of scene.meshes){
        mesh.computeWorldMatrix(true);
        const bounds=mesh.getBoundingInfo().boundingBox;
        assert.ok([...bounds.minimumWorld.asArray(),...bounds.maximumWorld.asArray()].every(Number.isFinite),mesh.name);
      }
    }
    course.dispose();
  }finally{scene.dispose();engine.dispose();}
});
