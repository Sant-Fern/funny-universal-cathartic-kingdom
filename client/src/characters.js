import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { config,pogoStanceAngles } from '../../shared/physics.js';

export const TEAM_COLORS = ['#79d6b5','#eb9278'];
export const playerColor = team => TEAM_COLORS[team] ?? '#f3d58e';
export function createPogoStance(root){
  const stance=new TransformNode('inclinacion-del-pogo',root.getScene());
  stance.parent=root;stance.setPivotPoint(new Vector3(0,.03,.52));
  return stance;
}
export function createBottleFactory(scene) {
  const materials=[...TEAM_COLORS,playerColor(null)].map((hex,i)=>{
    const glass=new PBRMaterial(`vidrio-${i}`,scene);
    glass.albedoColor=Color3.FromHexString(i?'#a9d0c1':'#90bfae');
    glass.metallic=0;glass.roughness=.12;glass.alpha=.62;glass.indexOfRefraction=1.5;
    glass.backFaceCulling=false;glass.environmentIntensity=.8;
    const label=new StandardMaterial(`etiqueta-${i}`,scene);label.diffuseColor=Color3.FromHexString(hex);label.specularColor=Color3.Black();
    return{glass,label};
  });
  const profile=[new Vector3(0,-.22,0),new Vector3(.095,-.22,0),new Vector3(.108,-.19,0),new Vector3(.108,.015,0),
    new Vector3(.10,.06,0),new Vector3(.041,.13,0),new Vector3(.037,.25,0),new Vector3(.048,.25,0),new Vector3(.048,.28,0),new Vector3(.032,.28,0),new Vector3(.032,.17,0)];
  const heavyLabel=new StandardMaterial('etiqueta-pesada',scene);
  heavyLabel.diffuseColor=Color3.FromHexString('#efad59');
  heavyLabel.emissiveColor=Color3.FromHexString('#51381d');
  return function bottle(team,parent,kind='standard'){
    const style=materials[team??2];
    const root=new TransformNode('botella-de-cristal',scene);root.parent=parent||null;
    const body=MeshBuilder.CreateLathe('cristal',{shape:profile,tessellation:14,closed:false},scene);
    body.material=style.glass;body.parent=root;
    const label=MeshBuilder.CreateCylinder('etiqueta',{diameter:.22,height:.13,tessellation:14},scene);
    label.material=kind==='heavy'?heavyLabel:style.label;label.position.y=-.08;label.parent=root;
    const lip=MeshBuilder.CreateTorus('boca',{diameter:.08,thickness:.012,tessellation:14},scene);
    lip.material=style.glass;lip.position.y=.275;lip.parent=root;
    if(kind==='heavy')root.scaling.set(1.65,1.1,1.65);
    return root;
  };
}

export async function createCharacterFactory(scene,shadow,material,bone,box,bottleFactory,{quality='high',signal}={}){
  const modelFile=quality==='low'?'anatomical-skeleton-low.glb':'anatomical-skeleton.glb';
  const response=await fetch('/models/'+modelFile,{signal});
  if(!response.ok)throw new Error('No se pudo descargar el esqueleto. Vuelve a intentarlo.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  signal?.throwIfAborted();
  let model;
  try{
    model=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb',name:modelFile});
  }catch(error){
    signal?.throwIfAborted();
    throw new Error('No se pudo preparar el esqueleto. Vuelve a intentarlo o elige Rendimiento.',{cause:error});
  }
  if(signal?.aborted){model.dispose();signal.throwIfAborted();}
  scene.onDisposeObservable.addOnce(()=>model.dispose());
  const lowBoneMaterial=new StandardMaterial('hueso-ligero',scene);
  lowBoneMaterial.diffuseColor=Color3.White();
  lowBoneMaterial.emissiveColor=new Color3(.24,.21,.16);
  lowBoneMaterial.specularColor=Color3.Black();
  lowBoneMaterial.maxSimultaneousLights=2;
  for(const mesh of model.meshes){
    if(mesh.getTotalVertices())mesh.receiveShadows=true;
    if(quality==='low')mesh.material=lowBoneMaterial;
  }
  return function character(id,team,lowQuality){
    const root=new TransformNode(`personaje-${id}`,scene),stance=createPogoStance(root),balance=new TransformNode('balance-del-pogo',scene),elastic=new TransformNode('cuerpo-elastico',scene);
    balance.parent=stance;balance.setPivotPoint(new Vector3(0,.03,.52));elastic.parent=balance;
    elastic.setPivotPoint(new Vector3(0,.63,.10));
    // The anatomical model has rigid joints and one shared material.
    const entries=model.instantiateModelsToScene(name=>`${id}:${name}`,false,{doNotInstantiate:false});
    for(const model of entries.rootNodes){model.parent=elastic;model.setEnabled(true);}
    const nodes=elastic.getDescendants(),joint=name=>nodes.find(n=>n.name.endsWith(`:${name}`));
    const casters=elastic.getChildMeshes();
    for(const mesh of casters){mesh.isPickable=false;shadow.addShadowCaster(mesh);}
    const upperR=joint('upperArmR'),foreR=joint('forearmR'),upperL=joint('upperArmL'),foreL=joint('forearmL'),head=joint('head');
    const thighs=[joint('thighL'),joint('thighR')],shins=[joint('shinL'),joint('shinR')];
    for(const node of [upperR,foreR,upperL,foreL,head,...thighs,...shins])if(node)node.rotationQuaternion=null;
    const held=Object.fromEntries(['standard','heavy'].map(kind=>{
      const bottle=bottleFactory(team,foreR,kind);
      bottle.position.set(-.055,-.46,.08);bottle.rotation.x=.5;
      return [kind,bottle];
    }));
    const pogo=new TransformNode('pogo',scene);pogo.parent=balance;
    const springPath=Array.from({length:120},(_,i)=>new Vector3(Math.cos(i/119*Math.PI*16)*.115,.09+i/119*.43,.52+Math.sin(i/119*Math.PI*16)*.115));
    const spring=MeshBuilder.CreateTube('resorte-flexible',{path:springPath,radius:.026,tessellation:6},scene);
    spring.material=material(playerColor(team));spring.parent=pogo;
    const shaft=bone('vástago',[0,.15,.52],[0,1.86,.52],.033,'#6b7775',pogo);
    box('soporte-estribos',[.63,.075,.13],[0,.56,.47],'#3b4540',pogo);
    for(const side of [-1,1]){
      box('brazo-estribo',[.075,.07,.45],[side*.145,.56,.30],'#6b7775',pogo);
      box('apoyo-del-pie',[.19,.065,.33],[side*.145,.60,.10],'#3b4540',pogo);
    }
    box('manillar',[.73,.055,.08],[0,1.88,.54],'#6b7775',pogo);
    for(const side of [-1,1])box('empuñadura',[.15,.075,.11],[side*.29,1.88,.54],playerColor(team),pogo);
    const foot=MeshBuilder.CreateSphere('tope-goma',{diameter:.19,segments:10},scene);
    foot.scaling.y=.45;foot.position.set(0,.04,.52);foot.material=material('#2d3933');foot.parent=pogo;
    const sash=MeshBuilder.CreateTorus('identificador-equipo',{diameter:.16,thickness:.026,tessellation:16},scene);
    sash.parent=elastic;sash.position.set(0,2.43,0);sash.material=material(playerColor(team));
    let forwardLean=0,sideLean=0;
    function animate(p,time,throwCharge=0,jumpCharge=0,dt=.05){
      const since=Math.max(0,time-(p.landedAt??-100)),sinceJump=Math.max(0,time-(p.jumpedAt??-100));
      const vy=p.vy||0,strength=Math.min(1,(p.impactSpeed||0)/config.jumpMaxSpeed);
      const landing=strength*Math.exp(-since*10),follow=strength*Math.sin(since*23)*Math.exp(-since*8);
      const kick=Math.max(0,vy)/config.jumpMaxSpeed*Math.exp(-sinceJump*5);
      const sinceHit=Math.max(0,time-(p.hitAt??-100));
      const flinch=(p.hitForce??0)*(1-Math.exp(-sinceHit*42))*Math.exp(-sinceHit*5);
      const fall=Math.min(1,sinceHit/.58);
      const collapse=p.health<=0 ? fall*fall*(3-2*fall) : 0;
      const incoming=(p.hitYaw??p.yaw)-p.yaw;
      const tilt=.86*flinch+1.49*collapse;
      const vertical=Math.max(.6,1-.31*landing+.075*follow+.24*kick-.23*jumpCharge);
      elastic.scaling.set(1/Math.sqrt(vertical),vertical,1/Math.sqrt(vertical));
      const lean=Math.max(-1,Math.min(1,vy/config.jumpMaxSpeed));
      const stanceAngles=pogoStanceAngles(p);
      forwardLean=stanceAngles.pitch;sideLean=-stanceAngles.roll;
      stance.rotation.set(forwardLean*(1-collapse),0,-sideLean*(1-collapse));
      balance.rotation.x=(.16*lean+.11*jumpCharge-.14*landing)*(1-collapse)+Math.cos(incoming)*tilt;
      balance.rotation.z=-Math.sin(incoming)*tilt;
      elastic.rotation.x=.11*lean*(1-collapse)+.09*jumpCharge+.05*follow;
      elastic.rotation.z=(1-collapse)*Math.sin(time*3+Number(id.split('-').at(-1)||0))*.012;
      pogo.rotation.x=forwardLean*(1-collapse);
      pogo.rotation.z=-sideLean*(1-collapse)+.52*collapse;
      pogo.position.x=.27*collapse;
      spring.scaling.y=Math.max(.32,1-.54*landing+.10*follow-.51*jumpCharge+.16*kick);
      shaft.scaling.y=1-.10*landing-.07*jumpCharge;
      const sinceThrow=time-(p.lastThrowAt??-100),throwing=sinceThrow>=0&&sinceThrow<.43;
      if(upperR){upperR.rotation.x=throwing&&!collapse?-2.1+Math.sin(Math.min(1,sinceThrow/.30)*Math.PI/2)*2.5:-.22-throwCharge*1.9;upperR.rotation.z=.7*collapse+.2*flinch;}
      if(foreR)foreR.rotation.x=throwing&&!collapse?-.25:-1.15-throwCharge*.45+.7*collapse;
      if(upperL){upperL.rotation.x=-.25-.12*landing-.45*collapse;upperL.rotation.z=-.86*collapse-.2*flinch;}
      if(foreL)foreL.rotation.x=-1.15+.85*collapse;
      if(head){head.rotation.x=-.04+Math.sin(time*3)*.025+.30*collapse;head.rotation.z=follow*.04+.43*collapse;}
      thighs.forEach((n,i)=>{if(n)n.rotation.x=(i?.44:-.14)*collapse;});
      shins.forEach((n,i)=>{if(n)n.rotation.x=(i?-.58:-.32)*collapse;});
      const kind=p.bottle==='heavy'?'heavy':'standard';
      held.standard.setEnabled(p.health>0&&!throwing&&kind==='standard');
      held.heavy.setEnabled(p.health>0&&!throwing&&kind==='heavy');
    }
    return{root,stance,animate,dispose(){
      for(const mesh of casters)shadow.removeShadowCaster(mesh);
      root.dispose();
    }};
  };
}
