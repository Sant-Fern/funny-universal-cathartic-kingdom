import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3,Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { Color3,Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { createAuditorium } from './auditorium.js';
import { createBottleFactory,createCharacterFactory,playerColor } from './characters.js';
import { arenaObstacles,heightAt,launchVelocity,throwOrigin,trajectory,segmentBox,obstacleAt,config } from '../../shared/physics.js';

const color=hex=>Color3.FromHexString(hex),v=(x,y,z)=>new Vector3(x,y,z);
export async function createWorld(canvas,updateMouse,initialQuality='high'){
  const engine=new Engine(canvas,false,{stencil:true});
  const scene=new Scene(engine);scene.clearColor=new Color4(.12,.19,.23,1);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogColor=color('#223b48');scene.fogDensity=.0045;
  const camera=new UniversalCamera('camera',v(24,13,-30),scene);camera.minZ=.12;camera.maxZ=600;camera.fov=.89;
  let cameraReach=1;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  camera.setTarget(v(0,3,7));
  const ambient=new HemisphericLight('relleno-de-gradas',v(.2,1,.1),scene);
  ambient.intensity=.49;ambient.diffuse=color('#bddce6');ambient.groundColor=color('#566477');
  const sun=new DirectionalLight('luz-oblicua-de-servicio',v(.62,-1,.38),scene);
  sun.position=v(-19,28,-11);sun.diffuse=color('#ffe4c2');sun.intensity=1.55;
  sun.autoUpdateExtends=false;sun.orthoLeft=-config.width/2-18;sun.orthoRight=config.width/2+18;
  sun.orthoTop=config.depth/2+22;sun.orthoBottom=-sun.orthoTop;
  sun.shadowMinZ=1;sun.shadowMaxZ=180;
  const shadow=new ShadowGenerator(2048,sun);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias=.0008;shadow.normalBias=.028;shadow.setDarkness(.12);
  const pipeline=new DefaultRenderingPipeline('acabado',true,scene,[camera],false);
  pipeline.bloomThreshold=.95;pipeline.bloomWeight=.16;pipeline.bloomKernel=46;
  scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.12;scene.imageProcessingConfiguration.contrast=1.09;
  scene.imageProcessingConfiguration.vignetteWeight=.76;scene.imageProcessingConfiguration.vignetteStretch=.30;
  let lowQuality=false;
  function resize(){
    const highScale=Math.max(1,devicePixelRatio/1.65);
    const scale=lowQuality
      ? Math.max(highScale*1.8,canvas.clientWidth/960,canvas.clientHeight/540)
      : highScale;
    engine.setHardwareScalingLevel(scale);
  }
  function applyQuality(quality){
    lowQuality=quality==='low';
    scene.shadowsEnabled=!lowQuality;
    scene.imageProcessingConfiguration.vignetteEnabled=!lowQuality;
    pipeline.fxaaEnabled=!lowQuality;
    pipeline.bloomEnabled=!lowQuality;
    pipeline.imageProcessingEnabled=!lowQuality;
    pipeline.prepare();
    resize();
  }
  applyQuality(initialQuality);
  const materials=new Map();
  function material(hex,glow=false){
    const key=`${hex}:${glow}`;if(materials.has(key))return materials.get(key);
    const m=new StandardMaterial(key,scene);m.diffuseColor=color(hex);m.specularColor=color('#363d43');m.specularPower=31;
    if(glow)m.emissiveColor=color(hex);materials.set(key,m);return m;
  }
  function box(name,size,position,hex,parent){
    const mesh=MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);
    mesh.position=v(...position);mesh.material=material(hex);mesh.parent=parent||null;mesh.receiveShadows=true;return mesh;
  }
  function sphere(name,size,position,hex,parent){
    const mesh=MeshBuilder.CreateSphere(name,{diameter:1,segments:12},scene);mesh.scaling=v(...size);mesh.position=v(...position);
    mesh.material=material(hex);mesh.parent=parent||null;return mesh;
  }
  function bone(name,start,end,radius,hex,parent){
    const a=v(...start),b=v(...end),d=b.subtract(a),mesh=MeshBuilder.CreateCylinder(name,{height:d.length(),diameter:radius*2,tessellation:10},scene);
    mesh.position=a.add(b).scale(.5);mesh.rotationQuaternion=Quaternion.FromUnitVectorsToRef(Vector3.Up(),d.normalize(),new Quaternion());
    mesh.material=material(hex);mesh.parent=parent||null;return mesh;
  }
  const auditorium=createAuditorium({scene,material,box,bone,shadow});
  auditorium.setLowQuality(lowQuality);
  const bottleFactory=createBottleFactory(scene);
  const makeCharacter=await createCharacterFactory(scene,shadow,material,bone,box,bottleFactory);
  const players=new Map(),projectiles=new Map(),labels=new Map(),shards=[],seenImpacts=new Set();
  const finish=config.obstacles.find(o=>o.route==='summit');
  const finishY=heightAt(finish.x,finish.z)+finish.h;
  const finishRing=MeshBuilder.CreateTorus('meta',{diameter:2*config.race.finishRadius,thickness:.08,tessellation:40},scene);
  const finishBeacon=MeshBuilder.CreateCylinder('baliza-de-meta',{diameter:.065,height:4,tessellation:8},scene);
  const finishFlag=MeshBuilder.CreatePolyhedron('señal-de-meta',{type:1,size:.40},scene);
  const finishMeshes=[finishRing,finishBeacon,finishFlag];
  for(const mesh of finishMeshes){
    mesh.material=material('#ffda80',true);
    mesh.isPickable=false;
  }
  finishRing.position.set(finish.x,finishY+.055,finish.z);
  finishBeacon.position.set(finish.x,finishY+2,finish.z);
  finishFlag.position.set(finish.x,finishY+4,finish.z);
  const balloonSources=['#f6c86c','#f28e8b','#79d7db'].map(hex=>{
    const mesh=MeshBuilder.CreateSphere('globo',{diameter:2*config.balloons.radius,segments:8},scene);
    mesh.material=material(hex,true);
    mesh.isPickable=false;
    mesh.setEnabled(false);
    return mesh;
  });
  function addBalloons(parent){
    const root=new TransformNode('globos-del-sujeto',scene);
    root.parent=parent;
    const targets=config.balloons.targets.map(([x,y,z],i)=>{
      const balloon=balloonSources[i].createInstance('globo-vivo');
      balloon.position.set(x,y,z);
      balloon.parent=root;
      const string=bone('cordel-de-globo',[0,2.48,0],[x,y-config.balloons.radius,z],.012,'#d4d5c6',root);
      return {balloon,string};
    });
    return {root,targets};
  }
  const shardSource=MeshBuilder.CreatePolyhedron('fragmento',{type:1,size:.07},scene);
  shardSource.material=material('#aec9ba');shardSource.setEnabled(false);
  const boneSource=MeshBuilder.CreatePolyhedron('astilla-de-hueso',{type:1,size:.13},scene);
  boneSource.material=material('#ece0c0');boneSource.setEnabled(false);
  const dustSource=MeshBuilder.CreateTorus('pulso-de-rebote',{diameter:.46,thickness:.018,tessellation:24},scene);
  dustSource.material=material('#90a9a6',true);dustSource.material.alpha=.36;dustSource.setEnabled(false);
  const dust=[],splashEffects=[];
  const splashMaterial=material('#f3b75a',true);
  const splashSource=MeshBuilder.CreateTorus('onda-de-rotura',{diameter:2,thickness:.028,tessellation:36},scene);
  splashSource.material=splashMaterial;splashSource.setEnabled(false);
  function pulse(x,y,z,radius){
    const mesh=splashSource.createInstance('pulso-de-impacto');
    mesh.position.set(x,y+.035,z);
    mesh.scaling.set(.1,1,.1);
    mesh.setEnabled(true);
    splashEffects.push({mesh,age:0,radius});
  }
  function floorBelow(p,time){
    let floor=heightAt(p.x,p.z);
    for(const o of obstacles){
      const box=obstacleAt(o,time);
      if(box.top<=p.y+.012&&Math.abs(p.x-box.x)<o.w/2+.12&&Math.abs(p.z-box.z)<o.d/2+.12)floor=Math.max(floor,box.top);
    }
    return floor;
  }
  function scatter(source,x,y,z,count,power,life,floor=null){
    for(let i=0;i<count;i++){
      if(shards.length>=100)shards.shift().mesh.dispose();
      const mesh=source.createInstance('resto-de-impacto');
      mesh.setEnabled(true);
      mesh.position.set(x,y,z);
      const angle=i/count*Math.PI*2, speed=power*(.8+(i%5)*.24);
      shards.push({mesh,velocity:v(Math.cos(angle)*speed,1.6+speed*.66,Math.sin(angle)*speed),age:0,life,floor});
    }
  }
  function burst(impact){
    if(seenImpacts.has(impact.id))return false;
    seenImpacts.add(impact.id);
    const heavy=impact.kind==='heavy',local=impact.owner===localId;
    const player=latest?.players.find(p=>p.id===localId);
    if(player){
      const distance=Math.hypot(player.x-impact.x,player.y-impact.y,player.z-impact.z);
      const volume=local ? .16 : .095*Math.max(0,1-distance/20);
      auditorium.impact(impact.hits>0,volume,local,heavy,impact.downs>0);
    }
    if(heavy&&mode==='race'){
      pulse(impact.x,impact.y,impact.z,config.heavyBottle.splashRadius);
    }
    scatter(shardSource,impact.x,impact.y,impact.z,heavy?18:impact.hits?12:8,heavy?4.6:3,.55);
    if(seenImpacts.size>1200)seenImpacts.delete(seenImpacts.values().next().value);
    return local;
  }
  function nameLabel(p){
    const texture=new DynamicTexture(`nombre-${p.id}`,{width:512,height:64},scene,false);texture.hasAlpha=true;
    texture.drawText(`${p.name}${p.bot?' · BOT':''}`,null,46,'bold 31px Arial',playerColor(p.team),'transparent',true);
    const mat=new StandardMaterial(`nombre-${p.id}`,scene);mat.diffuseTexture=texture;mat.emissiveColor=Color3.White();mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.backFaceCulling=false;
    const mesh=MeshBuilder.CreatePlane(`nombre-${p.id}`,{width:2.5,height:.32},scene);mesh.material=mat;mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;
    labels.set(p.id,{mesh,texture,material:mat,name:p.name,bot:p.bot});
  }
  let latest=null,previous=null,receivedAt=0,localId=null,active=false,yaw=Math.PI/2,pitch=-.08,power=.6,charging=false,jumpCharge=null,bottle='standard';
  let mode,obstacles;
  function disposeLabel(label){
    label.mesh.dispose();label.texture.dispose();label.material.dispose();
  }
  function setSnapshot(s){
    if(s.matchId!==latest?.matchId)seenImpacts.clear();
    previous=latest;latest=s;receivedAt=performance.now();
    auditorium.onSnapshot(s);
    for(const p of s.players){
      if(!players.has(p.id)){
        const player=makeCharacter(p.id,p.team,lowQuality);
        if(p.team===null)player.balloons=addBalloons(player.root);
        players.set(p.id,player);
      }
      const balloons=players.get(p.id).balloons;
      if(balloons)balloons.targets.forEach(({balloon,string},i)=>{
        const intact=Boolean(p.balloons & (1<<i));
        balloon.setEnabled(intact);string.setEnabled(intact);
      });
      const old=labels.get(p.id);
      if(!old||old.name!==p.name||old.bot!==p.bot){if(old)disposeLabel(old);nameLabel(p);}
      const was=previous?.players.find(o=>o.id===p.id);
      if(active&&was?.health>0&&p.health===0){
        const floor=floorBelow(p,s.time);
        scatter(boneSource,p.x,p.y+1.5,p.z,12,3.8,1.12,floor);
        pulse(p.x,floor,p.z,1.45);
        if(p.id===localId)auditorium.monitor();
      }
      if(was&&p.landedAt>was.landedAt&&p.health>0&&p.impactSpeed>0){
        const mesh=dustSource.createInstance('polvo-de-rebote');mesh.setEnabled(true);mesh.position.set(p.x,p.y+.07,p.z);dust.push({mesh,age:0,strength:Math.min(1,p.impactSpeed/config.jumpMaxSpeed)});
      }
    }
    const ids=new Set(s.shots.map(p=>p.id));
    for(const[id,mesh]of projectiles)if(!ids.has(id)){mesh.dispose();projectiles.delete(id);}
    for(const shot of s.shots)if(!projectiles.has(shot.id))projectiles.set(shot.id,bottleFactory(shot.team,null,shot.kind));
    let hits=0,downs=0;
    for(const impact of s.impacts||[]){
      if(burst(impact)){hits+=impact.hits;downs+=impact.downs||0;}
    }
    return {hits,downs};
  }
  const guideMaterial=material('#ffffff',true);guideMaterial.disableLighting=true;guideMaterial.alpha=.88;guideMaterial.disableDepthWrite=true;
  let guide=null;
  const marker=MeshBuilder.CreateTorus('punto-de-caida',{diameter:.65,thickness:.035,tessellation:28},scene);marker.material=guideMaterial;marker.setEnabled(false);
  const splashPreview=MeshBuilder.CreateTorus('alcance-pesada',{diameter:config.heavyBottle.splashRadius*2,thickness:.026,tessellation:48},scene);
  splashPreview.material=splashMaterial;splashPreview.setEnabled(false);splashPreview.isPickable=false;
  function updateGuide(p,time){
    if(!p||p.health<=0||latest?.status==='finished'){guide?.setEnabled(false);marker.setEnabled(false);splashPreview.setEnabled(false);return;}
    const origin=throwOrigin(p.x,p.y,p.z,yaw),vel=launchVelocity(yaw,pitch,power,bottle),points=trajectory(origin,vel,bottle,time,obstacles);
    const path=Array.from({length:81},(_,i)=>{
      const f=i/80*(points.length-1),index=Math.min(points.length-2,Math.floor(f)),a=points[index],b=points[index+1],t=f-index;
      return v(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
    });
    if(!guide){guide=MeshBuilder.CreateTube('arco-blanco',{path,radius:.027,tessellation:6,updatable:true},scene);guide.material=guideMaterial;guide.isPickable=false;}
    else MeshBuilder.CreateTube('arco-blanco',{path,instance:guide},scene);
    guide.setEnabled(true);marker.setEnabled(true);marker.position.copyFrom(path.at(-1));
    marker.position.y+=.025;marker.scaling.setAll(1+Math.sin(performance.now()*.005)*.08);
    splashPreview.setEnabled(bottle==='heavy'&&mode==='race');
    splashPreview.position.copyFrom(marker.position);
  }
  function clearCameraReach(target,wanted,time){
    let nearest=1;
    for(const o of obstacles){
      const box=obstacleAt(o,time);
      const t=segmentBox(target,wanted,{x:box.x-o.w/2-.2,y:box.bottom-.2,z:box.z-o.d/2-.2},
        {x:box.x+o.w/2+.2,y:box.top+.2,z:box.z+o.d/2+.2});
      if(t!==null)nearest=Math.min(nearest,t);
    }
    return nearest===1?1:Math.max(0,nearest-.025);
  }
  function render(){
    const now=performance.now(),dt=Math.min(engine.getDeltaTime()/1000,.06),alpha=Math.min(1,(now-receivedAt)/50);
    updateMouse(dt);
    const simTime=(latest?.time||0)+Math.min(.05,(now-receivedAt)/1000);
    const olderTime=previous?.matchId===latest?.matchId?(previous?.time??0):(latest?.time??0);
    const platformTime=active?olderTime+((latest?.time??0)-olderTime)*alpha:now/1000;
    let me=null;
    if(latest){
      for(const p of latest.players){
        const player=players.get(p.id),old=previous?.players.find(o=>o.id===p.id)||p;
        const teleport=Math.hypot(p.x-old.x,p.z-old.z)>5;
        player.root.position.set(teleport?p.x:old.x+(p.x-old.x)*alpha,teleport?p.y:old.y+(p.y-old.y)*alpha,teleport?p.z:old.z+(p.z-old.z)*alpha);
        const falling=active&&p.health===0&&p.hitAt>=0;
        const timeSinceDown=falling?Math.max(0,simTime-p.hitAt):0;
        if(falling)player.root.position.y=Math.max(floorBelow(p,platformTime),p.y-12*timeSinceDown**2);
        const facing=p.id===localId&&active&&!falling?yaw:p.yaw;
        const previewTime=!active?now/1000:simTime;
        if(!active){
          const offset=Number(p.id.split('-').at(-1))*.28,phase=(previewTime+offset)%3.1;
          const speed=8.5,flight=2*speed/config.gravity,t=phase-1.1,airborne=t>=0&&t<flight;
          const preload=t<0?Math.max(0,1+t/.56):0;
          player.root.position.y=p.y+(airborne?speed*t-.5*config.gravity*t*t:0);
          player.animate({...p,vy:airborne?speed-config.gravity*t:0,
            jumpedAt:airborne?previewTime-t:-100,landedAt:t>=flight?previewTime-t+flight:-100,impactSpeed:speed},previewTime,0,preload);
        }else player.animate(p.id===localId?{...p,bottle,yaw:facing}:p,simTime,p.id===localId&&charging?power:0,p.id===localId?(jumpCharge??0):0);
        player.root.rotation.y=facing;
        if(player.balloons)player.balloons.root.rotation.y=-facing;
        player.root.setEnabled(p.health>0||(falling&&timeSinceDown<2.2));
        const label=labels.get(p.id).mesh;label.position.copyFrom(player.root.position);label.position.y+=mode==='race'?3.12:4.05;
        label.setEnabled(p.health>0&&p.id!==localId);
        if(p.id===localId)me={...p,x:player.root.position.x,y:falling?p.y:player.root.position.y,z:player.root.position.z};
      }
      for(const s of latest.shots){
        const mesh=projectiles.get(s.id),old=previous?.shots.find(o=>o.id===s.id)||s;
        mesh.position.set(old.x+(s.x-old.x)*alpha,old.y+(s.y-old.y)*alpha,old.z+(s.z-old.z)*alpha);
        mesh.rotation.set(s.age*11,s.age*3,s.age*5);
      }
    }
    if(active&&me){
      const aim=v(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)),right=v(Math.cos(yaw),0,-Math.sin(yaw));
      const impact=Math.min(1,(me.impactSpeed??0)/config.jumpMaxSpeed)*Math.exp(-11*Math.max(0,simTime-(me.landedAt??-100)));
      const target=v(me.x,me.y+1.9,me.z),wanted=target.subtract(aim.scale(7.4)).add(v(0,1.2-.24*impact,0)).add(right.scale(1.1));
      const xLimit=config.width/2+2.6,zLimit=config.depth/2+2.6;
      wanted.x=Math.max(-xLimit,Math.min(xLimit,wanted.x));
      wanted.z=Math.max(-zLimit,Math.min(zLimit,wanted.z));
      wanted.y=Math.min(config.ceilingHeight-1.35,Math.max(heightAt(wanted.x,wanted.z)+.6,wanted.y));
      const safe=clearCameraReach(target,wanted,platformTime);
      cameraReach=Math.min(safe,cameraReach+(safe-cameraReach)*(1-Math.exp(-8*dt)));
      const lookTarget=target.add(aim.scale(30));
      Vector3.LerpToRef(target,wanted,cameraReach,camera.position);
      const age=Math.max(0,simTime-(me.hitAt??-100));
      if(age<.19&&!reducedMotion.matches){
        const rise=Math.min(1,age/.045),decay=1-Math.max(0,(age-.045)/.145);
        const kick=v(Math.sin(me.hitYaw),.18,Math.cos(me.hitYaw)).scale(.34*me.hitForce*rise*decay**2);
        if(cameraReach>.42){
          camera.position.addInPlace(kick);
          lookTarget.addInPlace(kick);
        }
      }
      camera.setTarget(lookTarget);
      if(me.health>0&&Vector3.DistanceSquared(camera.position,target)<2.45**2){
        players.get(localId).root.setEnabled(false);
      }
      updateGuide(me,platformTime);
    }else{
      guide?.setEnabled(false);marker.setEnabled(false);splashPreview.setEnabled(false);
      camera.position.set(config.width*.45+Math.sin(now*.00004)*1.3,12.7,-config.depth*.66);camera.setTarget(v(0,5.4,5));
      cameraReach=1;
    }
    for(let i=shards.length-1;i>=0;i--){
      const s=shards[i];
      s.age+=dt;s.velocity.y-=15*dt;s.mesh.position.addInPlace(s.velocity.scale(dt));
      if(s.floor!==null&&s.mesh.position.y<s.floor+.08&&s.velocity.y<0){
        s.mesh.position.y=s.floor+.08;
        s.velocity.scaleInPlace(.49);s.velocity.y*=-.47;
      }
      s.mesh.rotation.x+=dt*9;s.mesh.rotation.z+=dt*7;
      s.mesh.scaling.setAll(Math.max(.08,Math.min(1,(s.life-s.age)*3)));
      if(s.age>s.life){s.mesh.dispose();shards.splice(i,1);}
    }
    for(let i=dust.length-1;i>=0;i--){const s=dust[i];s.age+=dt;const size=.64+s.strength*.6+s.age*3;s.mesh.scaling.set(size,.72,size);if(s.age>.18+s.strength*.15){s.mesh.dispose();dust.splice(i,1);}}
    for(let i=splashEffects.length-1;i>=0;i--){
      const effect=splashEffects[i];
      effect.age+=dt;
      const radius=effect.radius*Math.min(1,effect.age/.21);
      effect.mesh.scaling.set(radius,1,radius);
      if(effect.age>.32){effect.mesh.dispose();splashEffects.splice(i,1);}
    }
    if(mode==='race')finishFlag.rotation.y+=dt*1.5;
    auditorium.update(now/1000,platformTime,lowQuality,mode);
    scene.render();
  }
  engine.runRenderLoop(render);window.addEventListener('resize',resize);
  function showLobby(){
    const positions=mode==='race'
      ? [[10,-9,0],...obstacles.filter(o=>o.tier).map(o=>[o.x,o.z,o.h])]
      : [[12,-9,0],[-11,-7,0],[2,7,0],[9,6,1.65]];
    setSnapshot({mode,time:0,status:'waiting',players:positions.map(([x,z,h],i)=>({
      id:`slot-${i}`,name:['Tibia','Fémur','Costilla','Cráneo','Rótula'][i%5],team:mode==='race'?i%2:null,bot:true,
      x,y:heightAt(x,z)+h,z,yaw:i===0?2.42:i%2?-Math.PI/2:Math.PI/2,health:100,
      balloons:(1<<config.balloons.targets.length)-1,
    })),shots:[],impacts:[]});
  }
  function rebuildCharacters(){
    for(const player of players.values())player.dispose();
    for(const label of labels.values())disposeLabel(label);
    players.clear();labels.clear();
    latest=null;
    showLobby();
  }
  function setMode(value){
    if(value===mode)return;
    mode=value;
    obstacles=arenaObstacles(mode);
    auditorium.setMode(mode);
    for(const mesh of finishMeshes)mesh.setEnabled(mode==='race');
    rebuildCharacters();
  }
  function setQuality(quality){
    if(active||lowQuality===(quality==='low'))return;
    applyQuality(quality);
    auditorium.setLowQuality(lowQuality);
    rebuildCharacters();
  }
  setMode('eliminations');
  return{setSnapshot,setMode,setQuality,getFPS:()=>engine.getFps(),renderer:engine.getGlInfo().renderer,
    enableAudio:auditorium.enableAudio,muteAudience:auditorium.mute,
    enter(id,facing){localId=id;active=true;yaw=facing;pitch=-.08;},
    leave(){
      localId=null;active=false;charging=false;jumpCharge=null;bottle='standard';
      for(const player of players.values())player.root.setEnabled(false);
      for(const label of labels.values())label.mesh.setEnabled(false);
      showLobby();
    },
    look(dx,dy){yaw=Math.atan2(Math.sin(yaw+dx*.0025),Math.cos(yaw+dx*.0025));pitch=Math.max(-.65,Math.min(.64,pitch-dy*.002));},
    setCharge(value,held){power=value;charging=held;},setBottle(kind){bottle=kind;},setJumpCharge(value){jumpCharge=value;},get aim(){return{yaw,pitch};}};
}
