import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3,Color4 } from '@babylonjs/core/Maths/math.color.js';
import { config,arenaBounds,platformOffset } from '../../shared/physics.js';
import { summit,towerEntries,towerTracks,towerStructures } from '../../shared/tower.js';
import { createApplause } from './audience.js';

// The strange objects ARE the landings. Their closed, rectangular cases use
// the exact collision dimensions; rounded details stay on those visible cases.
export function createDreamCourse({scene,material,box,shadow}){
  const first=scene.meshes.length,casters=new Set(),moving=[],clouds=[];
  const roots=config.race.sections.map((_,i)=>new TransformNode(`dream-sector-${i+1}`,scene));
  const bounds=arenaBounds('race');
  const ranges=roots.map((_,i)=>{
    const pads=[...towerTracks.flat(),...towerStructures].filter(p=>p.level===i+1);
    return {bottom:Math.min(...pads.map(p=>p.h-p.thickness)),top:Math.max(...pads.map(p=>p.h))};
  });
  const cream='#dfd1b4',ink='#343140',brass='#b79661';
  const block=(name,size,pos,tint,parent=null,cast=false)=>{
    const mesh=box(name,size,pos,tint,parent);mesh.isPickable=false;
    if(cast)casters.add(mesh);return mesh;
  };
  const round=(name,pos,diameter,height,tint,parent=null)=>{
    const mesh=MeshBuilder.CreateCylinder(name,{diameter,height,tessellation:40},scene);
    mesh.position.set(...pos);mesh.material=material(tint);mesh.parent=parent;mesh.isPickable=false;return mesh;
  };
  const volume=(name,pad,tint,parent=null,cast=false)=>{
    if(pad.shape!=='ellipse')return block(name,[pad.w,pad.thickness,pad.d],[pad.x,pad.h-pad.thickness/2,pad.z],tint,parent,cast);
    const mesh=MeshBuilder.CreateCylinder(name,{diameter:1,height:pad.thickness,tessellation:48},scene);
    mesh.scaling.x=pad.w;mesh.scaling.z=pad.d;mesh.position.set(pad.x,pad.h-pad.thickness/2,pad.z);
    mesh.material=material(tint);mesh.parent=parent;mesh.isPickable=false;if(cast)casters.add(mesh);return mesh;
  };
  const hoop=(name,pos,diameter,thickness,tint,parent=null,vertical=false)=>{
    const mesh=MeshBuilder.CreateTorus(name,{diameter,thickness,tessellation:40},scene);
    mesh.position.set(...pos);mesh.material=material(tint);mesh.parent=parent;mesh.isPickable=false;
    if(vertical)mesh.rotation.x=Math.PI/2;return mesh;
  };
  const paints=new Map();
  function surfacePaint(style,variant=0){
    const key=`${style}-${variant%4}`;if(paints.has(key))return paints.get(key);
    const texture=new DynamicTexture(key,{width:512,height:512},scene,false),c=texture.getContext();
    const colors=['#93605f','#718582','#b4976c','#81728a'],tint=colors[variant%4];
    c.fillStyle=tint;c.fillRect(0,0,512,512);
    const border=(color,pad=14)=>{c.strokeStyle=color;c.lineWidth=6;c.strokeRect(pad,pad,512-2*pad,512-2*pad);};
    const text=(value,size=85,color=cream)=>{c.fillStyle=color;c.font=`${size}px Georgia`;c.textAlign='center';c.textBaseline='middle';c.fillText(value,256,256,460);};
    const dot=(x,y,r,color=ink)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
    if(style==='bed'){
      c.fillStyle='#d9c9b1';c.fillRect(0,0,512,512);
      for(let row=0;row<6;row++)for(let col=0;col<6;col++){
        c.fillStyle=(row+col)%2?'#a8807e':'#758a88';c.fillRect(col*86,row*86,83,83);
      }
      c.fillStyle='#eee4d0';c.fillRect(65,28,382,95);border('#bfb29a',6);
    }else if(style==='domino'||style==='dice'){
      c.fillStyle='#e2d8be';c.fillRect(0,0,512,512);border('#a5957f',9);
      if(style==='domino'){
        c.fillStyle=ink;c.fillRect(22,251,468,9);
        for(const [x,y] of [[130,110],[380,175],[130,330],[380,330],[256,410]])dot(x,y,25);
      }else for(const [x,y] of [[115,115],[395,115],[256,256],[115,395],[395,395]])dot(x,y,34);
    }else if(style==='card'){
      c.fillStyle='#e9ddca';c.fillRect(0,0,512,512);border('#aa7474',12);
      text(['♠','♥','♣','♦'][variant%4],230,variant%2?'#934c55':ink);
      c.font='70px Georgia';c.fillText(['A','Q','K','J'][variant%4],70,64);
    }else if(style==='chessboard'){
      for(let row=0;row<8;row++)for(let col=0;col<8;col++){
        c.fillStyle=(row+col)%2?'#574958':'#d7c5b0';c.fillRect(col*64,row*64,64,64);
      }
      border(brass,5);
    }else if(style==='book'||style==='pencil-box'){
      border('#c4a67c',26);border('#c4a67c',43);text(style==='book'?['SUEÑO','NUNCA','AYER','∞'][variant%4]:'LÁPICES',55);
      c.fillStyle='#d2b887';c.fillRect(70,325,372,3);
    }else if(style==='gear'||style==='chess-rook'){
      c.fillStyle=style==='gear'?'#b59b65':'#d9cdb6';c.fillRect(0,0,512,512);
      dot(256,256,211,style==='gear'?'#706045':'#6d6571');dot(256,256,164,style==='gear'?'#bda775':'#d9cdb6');
      for(let i=0;i<8;i++){const a=i*Math.PI/4;dot(256+Math.sin(a)*190,256+Math.cos(a)*190,15,cream);}
      dot(256,256,42,ink);
    }else if(style==='clock'){
      c.fillStyle='#d2c9b8';c.fillRect(0,0,512,512);dot(256,256,234,'#e7dfcd');
      c.strokeStyle=ink;c.lineWidth=8;
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;c.beginPath();c.moveTo(256+Math.sin(a)*198,256+Math.cos(a)*198);c.lineTo(256+Math.sin(a)*221,256+Math.cos(a)*221);c.stroke();
      }
      c.beginPath();c.moveTo(256,256);c.lineTo(156,166);c.moveTo(256,256);c.lineTo(355,207);c.stroke();dot(256,256,13,'#b76466');border(brass,8);
    }else if(style==='record'){
      c.fillStyle='#b59c86';c.fillRect(0,0,512,512);dot(256,256,242,'#343442');
      for(let radius=100;radius<236;radius+=15){c.strokeStyle='#77717c';c.lineWidth=1;c.beginPath();c.arc(256,256,radius,0,Math.PI*2);c.stroke();}
      dot(256,256,82,'#b57977');dot(256,256,9,cream);
    }else if(style==='piano'){
      c.fillStyle=ink;c.fillRect(0,0,512,512);
      for(let i=0;i<12;i++){c.fillStyle='#e4dac3';c.fillRect(i*43+2,90,39,370);}
      for(let i=0;i<11;i++)if(i%7!==2&&i%7!==6){c.fillStyle='#33303a';c.fillRect(i*43+30,90,25,220);}
    }else if(style==='tea-tray'||style==='plate'){
      c.fillStyle='#b5908b';c.fillRect(0,0,512,512);dot(256,256,233,'#d6dcd0');dot(256,256,205,'#829b98');dot(256,256,190,'#ded9c4');
      dot(256,256,130,style==='tea-tray'?'#947262':'#d7cab8');border(brass,10);
    }else if(style==='chocolate'){
      c.fillStyle='#573e3e';c.fillRect(0,0,512,512);
      for(let row=0;row<4;row++)for(let col=0;col<4;col++){c.fillStyle='#96705a';c.fillRect(8+col*128,8+row*128,112,112);c.strokeStyle='#b58a68';c.strokeRect(18+col*128,18+row*128,92,92);}
    }else if(style==='sugar'){
      c.fillStyle='#d8d0c1';c.fillRect(0,0,512,512);border('#a5bcb0',22);text('DULCES\nSUEÑOS',52,'#647a78');
      for(let i=0;i<100;i++){c.fillStyle='#ede4cf88';c.fillRect((i*97)%512,(i*67)%512,3,3);}
    }else if(style==='door-step'){
      c.fillStyle='#8c727b';c.fillRect(0,0,512,512);border('#c8ad98',8);
      c.strokeStyle='#c8ad98';c.strokeRect(56,52,400,165);c.strokeRect(56,265,400,195);dot(445,245,14,brass);
    }else if(style==='frame'){
      c.fillStyle='#9caab0';c.fillRect(0,0,512,512);border('#c4a67c',12);border('#725f59',34);border('#c4a67c',44);
      c.fillStyle='#c4ccd055';c.fillRect(80,80,75,352);
    }else if(style==='suitcase'){
      border('#c7ad8c',12);for(const x of [90,390]){c.fillStyle='#53434b';c.fillRect(x,0,28,512);}text('07',110,'#cfbea1');
    }else if(style==='drawer'){
      border(brass,14);text('NO ABRIR',45);c.fillStyle=brass;c.fillRect(180,350,152,20);
    }else if(style==='inverted-house'){
      for(let row=0;row<5;row++)for(let col=0;col<5;col++){
        c.fillStyle=(row+col)%2?'#c4baa8':'#aeb6b1';c.fillRect(col*103,row*103,102,102);
      }
      border(cream,8);
    }else{
      c.fillStyle='#987b68';c.fillRect(0,0,512,512);
      for(let i=0;i<9;i++){c.fillStyle=i%2?'#ac8d75':'#806b62';c.fillRect(i*58,0,55,512);}border('#b8a188',5);
    }
    texture.update(true);texture.anisotropicFilteringLevel=4;
    const paint=new StandardMaterial(key+'-paint',scene);paint.diffuseTexture=texture;paint.specularColor=new Color3(.1,.1,.1);
    paints.set(key,paint);return paint;
  }
  function cap(style,variant,pad,parent){
    const mesh=volume('superficie-'+style,{...pad,h:pad.h+.016,thickness:.016},cream,parent);
    mesh.material=surfacePaint(style,variant);return mesh;
  }

  scene.clearColor=new Color4(.58,.50,.59,1);scene.fogColor=Color3.FromHexString('#c9b9c5');
  const skyTexture=new DynamicTexture('cielo-del-sueño',{width:512,height:512},scene,false),c=skyTexture.getContext();
  const gradient=c.createLinearGradient(0,0,0,512);gradient.addColorStop(0,'#6b5a79');gradient.addColorStop(.50,'#b6a5ba');gradient.addColorStop(.75,'#e4c8b5');gradient.addColorStop(1,'#a4acb8');
  c.fillStyle=gradient;c.fillRect(0,0,512,512);skyTexture.update(true);
  const skyPaint=new StandardMaterial('atmósfera-del-sueño',scene);skyPaint.emissiveTexture=skyTexture;skyPaint.diffuseColor=Color3.Black();skyPaint.disableLighting=true;
  const sky=MeshBuilder.CreateSphere('cielo-surreal',{diameter:1800,segments:24,sideOrientation:Mesh.BACKSIDE},scene);
  sky.material=skyPaint;sky.infiniteDistance=true;sky.applyFog=false;sky.isPickable=false;
  const moon=MeshBuilder.CreateSphere('luna-de-porcelana',{diameter:58,segments:24},scene);
  moon.position.set(-90,195,120);moon.material=material('#cfc7bb');moon.isPickable=false;
  const orbit=hoop('órbita-inclinada',[-90,195,120],83,.7,brass);orbit.rotation.x=.37;orbit.rotation.z=.48;

  const ground=block('suelo-de-la-habitación',[bounds.width,.8,bounds.depth],[0,-.4,0],ink);
  cap('chessboard',0,{x:0,z:0,h:0,w:bounds.width,d:bounds.depth});
  ground.receiveShadows=true;
  // A room without walls, outlined by its skirting and an enormous fallen frame.
  for(const side of [-1,1]){
    block('zócalo-de-la-habitación',[bounds.width,.2,.3],[0,-.08,side*bounds.depth/2],brass);
    block('zócalo-de-la-habitación',[.3,.2,bounds.depth],[side*bounds.width/2,-.08,0],brass);
  }
  for(const pad of towerEntries){block('entrada',[pad.w,pad.h,pad.d],[pad.x,pad.h/2,pad.z],cream,null,true);cap('book',pad.lane,pad,null);}

  for(const track of towerTracks)for(const pad of track){
    const {x,z,w,d,h,thickness,lane,level,motion,style,step}=pad;
    let parent=roots[level-1];
    if(motion){parent=new TransformNode('objeto-a-la-deriva',scene);parent.parent=roots[level-1];moving.push({pad,parent});}
    const palette=['#a17c74','#c2b398','#b7baab','#80677a','#8c9ba6','#b2a38f'];
    const tint=style==='piano'||style==='record'?ink:style==='chocolate'?'#755246':palette[level-1];
    const body=volume(style,pad,style==='gear'?brass:style==='chess-rook'?cream:tint,parent,true);
    body.metadata={courseSurface:{lane,step,shape:pad.shape??'box'}};
    if(style==='dice')body.material=surfacePaint('dice',lane);
    cap(style,Math.floor((step-1)/4)+lane,pad,parent);
    if(style==='book'){
      for(let line=0;line<3;line++)block('canto-de-páginas',[w-.15,.025,.018],[x,h-.18-line*.09,z-d/2-.01],cream,parent);
      for(const y of [h-.035,h-thickness+.035])block('tapa-del-libro',[w,.06,d],[x,y,z],tint,parent);
      if(thickness>4){
        const spine=MeshBuilder.CreatePlane('lomo-monumental',{width:w*.88,height:thickness*.88},scene);
        spine.position.set(x,h-thickness/2,z-d/2-.018);spine.parent=parent;spine.material=surfacePaint('book',step%4);spine.isPickable=false;
      }
    }else if(style==='bed'){
      block('somier-de-cama',[w,.2,d],[x,h-thickness+.1,z],ink,parent);
      for(const side of [-1,1])block('costura-del-colchón',[w-.12,.04,.018],[x,h-.28,z+side*(d/2+.01)],cream,parent);
    }else if(style==='suitcase'||style==='drawer'){
      block('asa',[w*.32,.12,.12],[x,h-thickness*.6,z-d/2-.06],brass,parent);
      for(const side of [-1,1])block('cierre',[.2,.3,.06],[x+side*w*.32,h-thickness*.5,z-d/2-.032],brass,parent);
      if(style==='drawer'&&thickness>4)for(let y=h-1.5;y>h-thickness+1;y-=3.2){
        block('frente-de-cajón',[w*.9,2.7,.06],[x,y,z-d/2-.04],cream,parent);
        block('tirador-de-cajón',[w*.28,.18,.15],[x,y,z-d/2-.12],brass,parent);
      }
    }else if(style==='tea-tray'||style==='plate'){
      const rim=hoop('borde-de-porcelana',[x,h-.08,z],1,.035,cream,parent);rim.scaling.set(w,1,d);
      if(style==='tea-tray')hoop('asa-monumental',[x+w*.5,h-thickness*.5,z],thickness*.8,.32,cream,parent,true);
    }else if(style==='inverted-house'){
      for(const side of [-1,1]){
        block('ventana-invertida',[w*.4,1.1,.025],[x,h-1.8,z+side*(d/2+.013)],'#4b5363',parent);
        block('cruz-de-ventana',[.07,1.1,.04],[x,h-1.8,z+side*(d/2+.03)],cream,parent);
      }
      const roof=MeshBuilder.CreateCylinder('tejado-invertido',{height:1.8,diameterTop:Math.min(w,d),diameterBottom:0,tessellation:4},scene);
      roof.position.set(x,h-thickness-.9,z);roof.rotation.y=Math.PI/4;roof.material=material('#8b6065');roof.parent=parent;roof.isPickable=false;
    }else if(style==='clock'||style==='record'||style==='chess-rook'){
      hoop('bisel-del-objeto',[x,h+.018,z],Math.min(w,d)*.94,.035,brass,parent);
    }
    // Small team-coloured tabs identify the mirrored routes without glowing rails.
    block('marca-de-ruta',[.14,.02,.27],[x-w*.43,h+.02,z-d*.35],lane?'#d89487':'#8ebdaf',parent);
  }
  for(const pad of towerStructures){
    const paint=pad.style==='gear-tooth'?brass:pad.style==='library-floor'?'#b5a58d':'#67575b';
    block(pad.style,[pad.w,pad.thickness,pad.d],[pad.x,pad.h-pad.thickness/2,pad.z],paint,roots[pad.level-1],true);
    if(pad.style==='library-floor')cap('table',0,pad,roots[pad.level-1]);
  }
  block('almohada-de-la-cima',[summit.w,summit.thickness,summit.d],[0,summit.h-summit.thickness/2,0],cream,null,true);
  cap('bed',2,summit,null);
  // The final door opens onto nothing: its sill is the shared summit surface.
  for(const side of [-1,1])block('marco-de-salida',[.23,6,.28],[side*3.35,summit.h+3,3.5],brass);
  block('dintel-de-salida',[6.95,.23,.28],[0,summit.h+6,3.5],brass);
  for(let band=0;band<4;band++)for(let i=0;i<7;i++){
    const angle=i*Math.PI*2/7+band*.43,radius=185+i%2*35;
    const mesh=MeshBuilder.CreateSphere('nube-de-almohada',{diameter:1,segments:8},scene);
    mesh.position.set(Math.cos(angle)*radius,band*53-12,Math.sin(angle)*radius);mesh.scaling.set(30,4,13);
    mesh.material=material('#ccc1c5');mesh.isPickable=false;clouds.push(mesh);
  }
  const groups=new Map(),animated=new Set(moving.map(o=>o.parent));
  for(const mesh of scene.meshes.slice(first)){
    if(mesh===sky||mesh===moon||clouds.includes(mesh)||!mesh.getTotalVertices())continue;
    const key=`${mesh.material.uniqueId}:${mesh.parent?.uniqueId??0}:${casters.has(mesh)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  }
  for(const group of groups.values()){
    const parent=group[0].parent,cast=casters.has(group[0]);
    const mesh=group.length>1?Mesh.MergeMeshes(group,true,true):group[0];if(!mesh)continue;
    mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;
    if(!animated.has(parent))mesh.freezeWorldMatrix();if(cast)shadow.addShadowCaster(mesh);
  }
  const applause=createApplause();let low=false,arrived=0;
  return {
    setLowQuality(value){low=value;clouds.forEach((cloud,i)=>cloud.setEnabled(!low||i%2===0));},
    setMode(){},
    onSnapshot(snapshot){const count=snapshot.players.filter(p=>p.finishPosition!=null).length;if(count>arrived)applause.play();arrived=count;},
    update(time,platformTime,quality,mode,viewHeight){
      for(const [i,root] of roots.entries())root.setEnabled(viewHeight===null||ranges[i].bottom<viewHeight+(low?45:75)&&ranges[i].top>viewHeight-65);
      for(const {pad,parent} of moving)parent.position[pad.motion.axis]=platformOffset(pad,platformTime);
    },
    dispose:applause.dispose,enableAudio:applause.enable,impact:applause.impact,monitor:applause.monitor,mute:applause.mute,count:0,
  };
}
