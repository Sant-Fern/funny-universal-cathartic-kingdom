import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { SpotLight } from '@babylonjs/core/Lights/spotLight.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { config,heightAt,platformOffset } from '../../shared/physics.js';
import { summit,towerEntries,towerObstacles,towerTracks } from '../../shared/tower.js';
import { createAudience,createApplause } from './audience.js';
import { buildInstitute } from './institute.js';

export function createAuditorium({scene,material,box,bone,shadow}){
  const start=scene.meshes.length,casters=new Set(),seats=[];
  const {width,depth}=config, halfX=width/2,halfZ=depth/2;
  const layouts={
    eliminations:new TransformNode('pista-de-globos',scene),
    race:new TransformNode('torre-del-instituto',scene),
  };
  const ceilingLift=config.ceilingHeight-14.55;
  const roomX=halfX+14,roomZ=halfZ+15.1,railX=halfX+.27,railZ=halfZ+.28;
  const wall='#263844',steel='#607b85',dark='#152531',trim='#3a5360',light='#d9e8e5';
  const lab=(name,size,pos,hex=wall,cast=false)=>{const mesh=box(name,size,pos,hex);if(cast)casters.add(mesh);return mesh;};
  const glow=(name,size,pos,hex='#73ccbd')=>{const mesh=lab(name,size,pos,hex);mesh.material=material(hex,true);return mesh;};
  const glass=new StandardMaterial('vidrio-de-observacion',scene);glass.diffuseColor=Color3.FromHexString('#6ea4b0');glass.specularColor=new Color3(.6,.75,.8);glass.alpha=.20;glass.backFaceCulling=false;glass.disableDepthWrite=true;
  const floorTexture=new DynamicTexture('losetas-del-laboratorio',{width:512,height:512},scene,false),f=floorTexture.getContext();
  const enamel=f.createLinearGradient(0,0,512,512);
  enamel.addColorStop(0,'#a2b7b7');enamel.addColorStop(.48,'#8da5a7');enamel.addColorStop(1,'#9fb3b4');
  f.fillStyle=enamel;f.fillRect(0,0,512,512);f.strokeStyle='#647e85';f.lineWidth=4;f.strokeRect(0,0,512,512);
  f.strokeStyle='#9ab0b088';f.lineWidth=3;f.strokeRect(9,9,494,494);f.strokeStyle='#71828624';f.lineWidth=1;
  for(let i=0;i<130;i++){const x=(i*113)%512,y=(i*73)%512;f.beginPath();f.moveTo(x,y);f.lineTo(x+3+(i%9),y+1);f.stroke();}
  for(const x of [21,491])for(const y of [21,491]){f.fillStyle='#769193';f.beginPath();f.arc(x,y,3.1,0,Math.PI*2);f.fill();}
  floorTexture.update(true);floorTexture.uScale=width/4;floorTexture.vScale=depth/4;floorTexture.anisotropicFilteringLevel=8;
  const floor=new StandardMaterial('baldosa-industrial',scene);floor.diffuseTexture=floorTexture;floor.specularColor=new Color3(.23,.30,.32);floor.emissiveColor=new Color3(.019,.024,.032);floor.specularPower=42;
  const mainFloor=MeshBuilder.CreateGround('plataforma-de-pruebas',{width:config.width, height:config.depth},scene);mainFloor.material=floor;mainFloor.receiveShadows=true;
  const markings=new DynamicTexture('huellas-de-luz-y-marcado',{width:1024,height:1024},scene,false);
  const ink=markings.getContext();
  const px=x=>(x+halfX)*1024/width, py=z=>(halfZ-z)*1024/depth;
  for(const [x,z,r,tint] of [[-10,-6,182,'#81cbe534'],[10,7,163,'#f5bd8030']]){
    ink.save();
    ink.translate(px(x),py(z));ink.scale(1,width/depth);
    const pool=ink.createRadialGradient(0,0,0,0,0,r);
    pool.addColorStop(0,tint);pool.addColorStop(1,'#ffffff00');
    ink.fillStyle=pool;ink.fillRect(-r,-r,r*2,r*2);
    ink.restore();
  }
  ink.shadowColor='#08131bbc';ink.shadowBlur=22;ink.shadowOffsetY=4;
  ink.fillStyle='#07141b88';
  for(const o of config.flatObstacles){
    ink.fillRect(px(o.x-o.w/2)-2,py(o.z+o.d/2)-2,o.w*1024/width+4,o.d*1024/depth+4);
  }
  ink.shadowBlur=0;ink.shadowOffsetY=0;
  for(const side of [-1,1]){
    ink.save();
    ink.translate(px(side*19),py(side*11.5));
    ink.rotate(side<0?Math.PI:0);
    ink.fillStyle='#c7d5bf98';ink.fillRect(-68,-41,3,80);
    ink.font='bold 44px monospace';ink.fillText('07',-53,7);
    ink.font='bold 12px monospace';ink.fillText('ENSAYO POST MORTEM',-53,29);
    ink.strokeStyle='#c7d5bf69';ink.lineWidth=2;ink.beginPath();
    ink.moveTo(21,-8);ink.lineTo(36,-8);ink.lineTo(41,-17);ink.lineTo(47,1);
    ink.lineTo(53,-28);ink.lineTo(60,-8);ink.lineTo(93,-8);ink.stroke();
    ink.restore();
  }
  // A painted safety oval frames the central console. Dashed lanes lead to either flank.
  ink.save();
  ink.strokeStyle='#e8bd7799';ink.lineWidth=3;
  ink.beginPath();ink.ellipse(px(0),py(0),5.1*1024/width,3.2*1024/depth,0,0,Math.PI*2);ink.stroke();
  for(const x of [-13.2,13.2]){
    ink.setLineDash([16,13]);ink.strokeStyle='#a4d9d4a0';
    ink.beginPath();ink.moveTo(px(x),py(-12));ink.lineTo(px(x),py(12));ink.stroke();
  }
  ink.setLineDash([]);
  ink.font='bold 24px monospace';ink.fillStyle='#c5d7cd';ink.textAlign='center';
  ink.fillText('PUESTO DE CONTROL',px(0),py(-3.8));
  for(const x of [-13.2,13.2])ink.fillText('FLANCO',px(x),py(-13.1));
  ink.restore();
  markings.hasAlpha=true;markings.update(true);
  const decal=new StandardMaterial('tinta-y-sombra-de-contacto',scene);
  decal.diffuseTexture=markings;decal.emissiveTexture=markings;
  decal.diffuseColor=Color3.Black();decal.useAlphaFromDiffuseTexture=true;
  decal.disableLighting=true;decal.disableDepthWrite=true;
  const floorDetail=MeshBuilder.CreateGround('marcado-del-ensayo',{width,height:depth},scene);
  floorDetail.position.y=.014;floorDetail.material=decal;floorDetail.isPickable=false;floorDetail.parent=layouts.eliminations;
  lab('estructura-de-la-plataforma',[width+.5,.5,depth+.5],[0,-.27,0],dark);
  lab('suelo-de-servicio',[roomX*2+1,.6,roomZ*2+1],[0,-.54,0],dark);
  for(let x=-halfX+2;x<halfX;x+=4)glow('junta-de-loseta',[.026,.009,depth-.45],[x,.008,0],'#2f4651');
  for(let z=-halfZ+1;z<halfZ;z+=4)glow('junta-de-loseta',[width-.25,.009,.026],[0,.008,z],'#2f4651');
  for(const side of [-1,1])for(let i=0;i<7;i++){
    const stripe=glow('marca-de-seguridad',[.12,.014,.52],[(i-3)*.28,.016,side*(halfZ-.52)],'#b79863');stripe.rotation.y=side*.42;
  }
  for(const side of [-1,1]){
    glow('marca-lateral',[.055,.012,depth-.8],[side*(halfX-.15),.013,0]);glow('marca-frontal',[width-.3,.012,.055],[0,.013,side*(halfZ-.2)]);
    const xCount=Math.ceil(railX*2/4.2),zCount=Math.ceil(railZ*2/3.75),xSpan=railX*2/xCount,zSpan=railZ*2/zCount;
    for(let i=0;i<xCount;i++){
      const x=-railX+(i+.5)*xSpan;
      const pane=lab('mampara-frontal',[xSpan-.13,1.48,.06],[x,.82,side*railZ]);pane.material=glass;
      lab('montante',[.085,1.64,.13],[x-xSpan/2,.78,side*railZ],steel);
    }
    for(let i=0;i<zCount;i++){
      const z=-railZ+(i+.5)*zSpan;
      const pane=lab('mampara-lateral',[.06,1.48,zSpan-.13],[side*railX,.82,z]);pane.material=glass;
      lab('montante',[.13,1.64,.085],[side*railX,.78,z-zSpan/2],steel);
    }
    lab('baranda-frontal',[railX*2,.065,.12],[0,1.58,side*railZ],steel);
    lab('baranda-lateral',[.12,.065,railZ*2],[side*railX,1.58,0],steel);
  }
  const laneTints=['#78d8bc','#eea282'], movingDecks=[];
  const lanePlates=['#345f5b','#6b514b'];
  const towerLevels=config.race.sections.map((_,index)=>{
    const root=new TransformNode('nivel-'+(index+1),scene);
    root.parent=layouts.race;
    return root;
  });
  function attach(parent,build){
    const first=scene.meshes.length;
    build();
    for(const mesh of scene.meshes.slice(first))mesh.parent=parent;
  }
  function sign(text,tint){
    const texture=new DynamicTexture('placa-'+text,{width:512,height:112},scene,false);
    const ctx=texture.getContext();
    ctx.fillStyle='#10232a';ctx.fillRect(0,0,512,112);
    ctx.strokeStyle=tint;ctx.lineWidth=5;ctx.strokeRect(4,4,504,104);
    ctx.fillStyle=tint;ctx.font='bold 46px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(text,256,57,466);
    texture.update(true);
    const plate=new StandardMaterial('señal-'+text,scene);
    plate.emissiveTexture=texture;plate.diffuseColor=Color3.Black();plate.disableLighting=true;
    return plate;
  }
  function plate(paint,width,height,x,y,z,yaw){
    const mesh=MeshBuilder.CreatePlane('placa-de-sección',{width,height},scene);
    mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.material=paint;mesh.isPickable=false;
  }
  const consoleSign=sign('CONTROL · 07','#efc483');
  const equipmentSign=sign('OBSERVACIÓN','#9ac9c7');
  attach(layouts.eliminations,()=>{
    for(const o of config.flatObstacles){
      const {x,z,w,d,h,feature}=o;
      const control=feature==='control';
      const stage=feature==='theatre',gallery=feature==='gallery';
      const color=stage?'#9c8d74':gallery?'#506d82':control?'#48606a':feature==='screen'?'#46676a':'#3a5660';
      const tint=control||stage?'#e8bc79':gallery?'#9fcae3':'#8fcfca';
      lab('cuerpo-de-instrumentos',[w,h,d],[x,h/2,z],color,true);
      lab('encimera',[w,.09,d],[x,h-.045,z],stage?'#ddd1b8':gallery?'#a5bdca':'#93a8a6',true);
      for(const side of [-1,1]){
        const face=z+side*(d/2+.016);
        lab('zócalo-técnico',[w-.16,.13,.034],[x,.16,face],dark);
        glow('piloto-de-instrumento',[w-.32,.032,.045],[x,h-.17,face],tint);
        if(control||feature==='screen')plate(control?consoleSign:equipmentSign,control?3.8:2.6,.30,x,h*.53,face+side*.021,side>0?Math.PI:0);
        else for(const offset of [-.56,0,.56]){
          lab('cajón-de-instrumentos',[.44,h*.42,.032],[x+offset,h*.49,face],trim);
          lab('tirador',[.23,.041,.048],[x+offset,h*.56,face+side*.022],light);
        }
      }
    }
  });
  for(const track of towerTracks){
    for(const [index,pad] of track.entries()){
      const {x,z,w,d,h,thickness,lane,level,motion}=pad;
      const sector=config.race.sections[level-1];
      const tint=motion?'#e3b7ff':laneTints[lane];
      const next=track[index+1]??summit;
      const parent=motion?new TransformNode('descanso-móvil',scene):towerLevels[level-1];
      if(motion){
        parent.parent=towerLevels[level-1];
        movingDecks.push({obstacle:pad,root:parent});
      }
      attach(parent,()=>{
        lab('bandeja-suspendida',[w,thickness,d],[x,h-thickness/2,z],
          motion?'#747792':sector.shell,true);
        if(pad.landing){
          lab('quilla-de-isla',[w*.76,.55,d*.72],[x,h-thickness-.275,z],'#364e5b');
          lab('quilla-de-isla',[w*.42,.36,d*.38],[x,h-thickness-.72,z],'#263b4b');
          for(const side of [-1,1]){
            glow('estabilizador',[.15,.27,.7],[x+side*w*.43,h-.55,z],sector.color);
          }
        }
        {
          const runner=lab('inserto-antideslizante',[w*.66,.022,d*.76],[x,h+.011,z],lanePlates[lane]);
          runner.isPickable=false;
          for(const side of [-1,1]){
            glow('señal-de-borde',[.36,.018,.11],[x+side*(w*.43),h+.013,z+d*.36],tint);
            glow('señal-de-borde',[.36,.018,.11],[x+side*(w*.43),h+.013,z-d*.36],tint);
          }
        }
        for(const side of [-1,1]){
          glow('canto-de-ruta',[w-.16,.075,.068],[x,h-.065,z+side*(d/2+.012)],tint);
          glow('canto-de-ruta',[.068,.075,d-.16],[x+side*(w/2+.012),h-.065,z],tint);
        }
        const yaw=Math.atan2(next.x-x,next.z-z);
        for(const side of [-1,1]){
          const arrow=glow('sentido-de-subida',[.08,.014,.48],
            [x+Math.cos(yaw)*side*.14,h+.01,z-Math.sin(yaw)*side*.14],tint);
          arrow.rotation.y=yaw-side*.66;
        }
      });
    }
  }
  const core=towerObstacles.find(o=>o.core);
  const levelHeight=config.race.rise*config.race.stepsPerSection;
  attach(layouts.race,()=>{
    lab('núcleo-de-ascenso',[core.w,core.h,core.d],[0,core.h/2,0],'#566f7c',false);
    for(const side of [-1,1]){
      for(const x of [-1.62,1.62])glow('línea-del-núcleo',[.15,core.h,.065],[x,core.h/2,side*(core.d/2+.028)],'#73b2c5');
      for(const z of [-1.62,1.62])glow('línea-del-núcleo',[.065,core.h,.15],[side*(core.w/2+.028),core.h/2,z],'#73b2c5');
      const x=side*config.race.startX,tint=laneTints[side>0?1:0];
      glow('línea-de-salida',[.12,.017,5.4],[x,.015,0],tint);
      glow('guía-de-salida',[.86,.015,.11],[side*(config.race.startX-1.45),.019,0],tint);
    }
    for(const entry of towerEntries){
      const {x,z,h,w,d,lane}=entry,tint=laneTints[lane];
      lab('peldaño-de-salida',[w,h,d],[x,h/2,z],'#496571',true);
      for(const side of [-1,1])glow('luz-de-salida',[.1,.054,d-.12],[x+side*(w/2-.08),h-.045,z],tint);
      for(const offset of [-1.3,0,1.3]){
        for(const side of [-1,1]){
          const arrow=glow('flecha-de-salida',[.42,.015,.075],[x-.14,h+.012,z+offset+side*.11],tint);
          arrow.rotation.y=(lane===0?1:-1)*side*.62;
        }
      }
    }
    lab('corona-de-meta',[summit.w,summit.thickness,summit.d],
      [summit.x,summit.h-summit.thickness/2,summit.z],'#9b8156',true);
  });
  for(let index=0;index<towerLevels.length;index++){
    const height=index*levelHeight;
    const paint=sign(String(index+1).padStart(2,'0')+' / '+config.race.sections[index].name,config.race.sections[index].color);
    attach(towerLevels[index],()=>{
      lab('anillo-de-inspección',[core.w+.14,.65,core.d+.14],[0,height+2.15,0],'#536e78',true);
      for(const side of [-1,1]){
        plate(paint,3.48,.74,0,height+2.4,side*(core.d/2+.085),side>0?Math.PI:0);
        plate(paint,3.48,.74,side*(core.w/2+.085),height+2.4,0,side>0?-Math.PI/2:Math.PI/2);
        glow('testigo-de-piso',[3.36,.055,.065],[0,height+1.93,side*(core.d/2+.084)],'#88c9c5');
        glow('testigo-de-piso',[.065,.055,3.36],[side*(core.w/2+.084),height+1.93,0],'#88c9c5');
      }
    });
  }
  const gallerySign=sign('GALERÍA DE OBSERVACIÓN','#ffd09c');
  const gallerySeats=[];
  attach(towerLevels[0],()=>{
    for(const side of [-1,1]){
      const z=side*(halfZ+1.6);
      for(const y of [8.8,17.6]){
        lab('balcón-clínico',[31.6,.86,5.2],[0,y-.43,z+side*2.1],'#394e5e',true);
        glow('luz-de-galería',[30.4,.09,.1],[0,y-.31,z-side*.49],'#f2b579');
        for(const x of [-14.2,-9.4,-4.7,0,4.7,9.4,14.2]){
          lab('montante-de-galería',[.15,1.3,.2],[x,y+.65,z-side*.47],'#78969a');
        }
        lab('baranda-de-galería',[30,.12,.14],[0,y+1.32,z-side*.47],'#6c8796');
        plate(gallerySign,9.7,1,0,y-.96,z-side*.58,side>0?Math.PI:0);
        for(const x of [-12.8,-10.4,-7.6,-4.6,4.6,7.6,10.4,12.8])gallerySeats.push({x,y,z:z+side*1.3});
      }
      for(const x of [-15.6,15.6]){
        lab('pórtico-de-atrio',[1.35,22.8,1.4],[x,11.4,z+.34*side],'#354a5b',true);
        glow('guía-vertical-de-atrio',[.19,21.4,.08],[x,11.5,z-.39*side],'#b5d6dc');
      }
    }
  });
  // Tiered grandstands with seats, aisle lights and railings on all four sides.
  const seat=(x,y,z,yaw)=>{
    seats.push({x,y,z});
    const base=lab('butaca',[.51,.12,.49],[x,y+.48,z],'#344d5a');base.rotation.y=yaw;
    const back=lab('respaldo',[.49,.66,.09],[x-Math.sin(yaw)*.23,y+.87,z-Math.cos(yaw)*.23],'#405967');back.rotation.y=yaw;
  };
  for(const side of [-1,1])for(let row=0;row<4;row++){
    const y=.70+row*1.03,z=halfZ+3.65+row*2.5,x=halfX+4.2+row*2.45;
    lab('graderia-frontal',[width+7,y+.24,2.5],[0,(y-.24)/2,side*z],row%2?trim:wall);
    lab('graderia-lateral',[2.45,y+.24,depth-.6],[side*x,(y-.24)/2,0],row%2?trim:wall);
    glow('led-frontal',[width+5,.045,.035],[0,y-.10,side*(z-1.26)],'#4e908d');
    glow('led-lateral',[.035,.045,depth-2],[side*(x-1.24),y-.10,0],'#4e908d');
    for(let col=0;col<30;col++){
      const sx=(col-14.5)*(width+3.4)/30;if(Math.abs(sx)<2)continue;
      seat(sx,y,side*z,side>0?Math.PI:0);
      lab('mesa-de-fila',[1.22,.08,.31],[sx,y+.78,side*(z-.83)],dark);
    }
    for(let col=0;col<22;col++){
      const sz=(col-10.5)*(depth-2.76)/22;if(Math.abs(sz)<1.5)continue;
      seat(side*x,y,sz,side>0?-Math.PI/2:Math.PI/2);
      lab('mesa-de-fila',[.31,.08,1.17],[side*(x-.78),y+.78,sz],dark);
    }
    for(const offset of [-2.6,2.6]){
      lab('pasamanos',[.055,.055,2.5],[offset,y+1.03,side*z],steel);
      lab('pilar-de-pasamanos',[.065,1.02,.065],[offset,y+.51,side*(z-1.15)],steel);
    }
  }

  // Observation galleries, structural ribs and bright overhead surgical luminaires.
  for(const side of [-1,1]){
    lab('muro-frontal',[roomX*2+1,14.8+ceilingLift,.56],[0,7.15+ceilingLift/2,side*roomZ],wall);
    lab('muro-lateral',[.56,14.8+ceilingLift,roomZ*2],[side*roomX,7.15+ceilingLift/2,0],wall);
    for(let i=-4;i<=4;i++){
      const x=i*(roomX-4.5)/4.1,z=i*(roomZ-4.5)/4.1;
      lab('costilla-frontal',[.38,14.6+ceilingLift,.7],[x,7.15+ceilingLift/2,side*(roomZ-.4)],steel);
      lab('costilla-lateral',[.7,14.6+ceilingLift,.38],[side*(roomX-.4),7.15+ceilingLift/2,z],steel);
      if(Math.abs(i)>1){
        lab('galeria-frontal',[6.5,2.4,.18],[x,9.35,side*(roomZ-.45)],dark);
        glow('ventanal-frontal',[6.15,1.9,.08],[x,9.35,side*(roomZ-.57)],'#478493');
        for(const off of [-2,0,2])lab('marco-de-observacion',[.055,1.92,.10],[x+off,9.35,side*(roomZ-.64)],steel);
        lab('galeria-lateral',[.18,2.4,5.9],[side*(roomX-.4),9.35,z],dark);
        glow('ventanal-lateral',[.08,1.9,5.55],[side*(roomX-.54),9.35,z],'#478493');
      }
    }
    glow('linea-de-galeria',[roomX*2-2,.045,.07],[0,6.7,side*(roomZ-.46)],'#73ccbd');
    glow('linea-lateral',[.07,.045,roomZ*2-2],[side*(roomX-.4),6.7,0],'#73ccbd');
    glow('linea-superior',[roomX*2-2,.07,.08],[0,17.4,side*(roomZ-.46)],'#6c9faa');
    glow('linea-superior',[.08,.07,roomZ*2-2],[side*(roomX-.4),17.4,0],'#6c9faa');
  }
  const ceilingStart=scene.meshes.length;
  lab('techo-acustico',[roomX*2+.8,.5,roomZ*2+.1],[0,config.ceilingHeight,0],dark);
  for(let x=-40;x<=40;x+=10)lab('viga-de-techo',[.52,.48,roomZ*2],[x,14.14+ceilingLift,0],trim);
  for(const z of [-30,-15,0,15,30])for(const x of [-32,-16,0,16,32]){
    lab('marco-de-luminaria',[8,.29,2.6],[x,13.75+ceilingLift,z],steel);
    glow('difusor-quirurgico',[7.62,.10,2.22],[x,13.55+ceilingLift,z],Math.abs(x)>=32?'#7296a3':'#a5bfc1');
    for(const off of [-.76,0,.76])lab('rejilla',[7.52,.045,.037],[x,13.46+ceilingLift,z+off],light);
  }
  for(const mesh of scene.meshes.slice(ceilingStart))mesh.parent=layouts.eliminations;
  attach(layouts.race,()=>{
    const opening=52, y=config.ceilingHeight;
    const sideWidth=roomX-opening/2, endDepth=roomZ-opening/2;
    for(const side of [-1,1]){
      lab('marco-del-atrio',[sideWidth,.52,roomZ*2],[side*(opening/2+sideWidth/2),y,0],dark);
      lab('marco-del-atrio',[opening,.52,endDepth],[0,y,side*(opening/2+endDepth/2)],dark);
      glow('luz-de-atrio',[.16,.09,opening],[side*opening/2,y-.34,0],'#9bbabd');
      glow('luz-de-atrio',[opening,.09,.16],[0,y-.34,side*opening/2],'#9bbabd');
    }
  });
  const accentEffects=[];
  function surgicalLamp(name,x,y,z,hex,direction,intensity){
    const lampStart=scene.meshes.length;
    const mount=config.ceilingHeight-.55;
    lab('brazo-de-lámpara',[.14,mount-y,.14],[x,(mount+y)/2,z],steel);
    const body=MeshBuilder.CreateCylinder('cúpula-de-lámpara',{diameterTop:2.25,diameterBottom:2.85,height:.34,tessellation:32},scene);
    body.position.set(x,y,z);body.material=material('#526874');
    const halo=MeshBuilder.CreateTorus('halo-quirúrgico',{diameter:2.53,thickness:.065,tessellation:40},scene);
    halo.position.set(x,y-.20,z);halo.material=material(hex,true);
    for(let i=0;i<7;i++){
      const angle=i/6*Math.PI*2,radius=i===6?0:.82;
      const lamp=MeshBuilder.CreateCylinder('lente-quirúrgica',{diameter:.35,height:.07,tessellation:12},scene);
      lamp.position.set(x+Math.cos(angle)*radius,y-.205,z+Math.sin(angle)*radius);
      lamp.material=material(hex,true);
    }
    const spot=new SpotLight(name,new Vector3(x,y-.25,z),new Vector3(...direction).normalize(),1.6,1.45,scene);
    spot.diffuse=Color3.FromHexString(hex);spot.specular=spot.diffuse;spot.intensity=intensity;spot.range=31;

    const haze=new DynamicTexture(name+'-neblina',{width:128,height:256},scene,false);
    const beam=haze.getContext(),fade=beam.createLinearGradient(0,0,0,256);
    fade.addColorStop(0,hex+'7a');fade.addColorStop(.32,hex+'34');fade.addColorStop(.88,hex+'08');fade.addColorStop(1,hex+'00');
    beam.fillStyle=fade;beam.globalAlpha=.10;
    for(let i=0;i<8;i++){
      const top=8+i*1.5,bottom=15+i*6.8;
      beam.beginPath();
      beam.moveTo(64-top,1);beam.lineTo(64+top,1);
      beam.lineTo(64+bottom,256);beam.lineTo(64-bottom,256);
      beam.closePath();beam.fill();
    }
    haze.hasAlpha=true;haze.update(true);
    const mist=new StandardMaterial(name+'-haz',scene);
    mist.diffuseTexture=haze;mist.emissiveTexture=haze;mist.diffuseColor=Color3.Black();
    mist.useAlphaFromDiffuseTexture=true;mist.disableLighting=true;mist.disableDepthWrite=true;mist.backFaceCulling=false;
    const shaft=MeshBuilder.CreatePlane('haz-de-examen',{width:12,height:8.5},scene);
    shaft.position.set(x,y-4.47,z);shaft.billboardMode=Mesh.BILLBOARDMODE_Y;shaft.material=mist;shaft.isPickable=false;
    shaft.parent=layouts.eliminations;
    for(const mesh of scene.meshes.slice(lampStart))mesh.parent=layouts.eliminations;
    accentEffects.push(spot,shaft);
    return mist;
  }
  const hazeMaterials=new Set([
    surgicalLamp('foco-de-examen-frío',-10,17.9,-6,'#b4e5ff',[.24,-1,.14],1.40),
    surgicalLamp('foco-de-examen-cálido',10,18.7,7,'#ffcd99',[-.22,-1,-.12],1.15),
  ]);
  for(const side of [-1,1])for(const end of [-1,1]){
    const x=side*(halfX+2),z=end*(halfZ+1);
    lab('columna-de-sensores',[.32,4.75,.32],[x,2.15,z],steel);
    glow('sensor-activo',[.43,.08,.43],[x,4.54,z],'#dcad73');
    lab('camara-de-registro',[.46,.30,.54],[x,4.28,z],dark);
    glow('led-de-registro',[.07,.07,.04],[x,4.28,z-.29],'#e1a17d');
  }

  const screen=new DynamicTexture('pantalla-de-estudio',{width:1024,height:384},scene,false),ctx=screen.getContext();
  const screenMat=new StandardMaterial('pantalla-emisiva',scene);screenMat.emissiveTexture=screen;screenMat.emissiveColor=Color3.Black();screenMat.diffuseColor=Color3.Black();screenMat.disableLighting=true;
  function display(x,y,z,yaw){
    const frame=lab('marco-de-pantalla',[17.5,6.3,.32],[x,y,z],dark);frame.rotation.y=yaw;
    const plane=MeshBuilder.CreatePlane('panel-de-experimento',{width:17,height:5.9},scene);plane.position.set(x-Math.sin(yaw)*.18,y,z-Math.cos(yaw)*.18);plane.rotation.y=yaw;plane.material=screenMat;
  }
  display(0,9.9,roomZ-1.05,0);display(0,9.9,1.05-roomZ,Math.PI);display(roomX-1.01,9.9,0,Math.PI/2);display(1.01-roomX,9.9,0,-Math.PI/2);

  buildInstitute({scene,lab,glow,bone,material,sign,plate,attach,
    layouts,towerLevels,levelHeight,roomX,roomZ,gallerySeats});

  // Batch the static architecture while keeping glass surfaces individually sorted.
  const movingRoots=new Set(movingDecks.map(deck=>deck.root));
  const groups=new Map();
  for(const mesh of scene.meshes.slice(start)){
    if(mesh.material===glass||mesh.material===screenMat||hazeMaterials.has(mesh.material)||mesh===mainFloor||mesh===floorDetail||!mesh.getTotalVertices())continue;
    const root=mesh.parent;
    const key=`${mesh.material.uniqueId}:${casters.has(mesh)}:${root?.uniqueId??'static'}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  }
  for(const meshes of groups.values()){
    const first=meshes[0],cast=casters.has(first),root=first.parent;
    const merged=meshes.length>1?Mesh.MergeMeshes(meshes,true,true):first;
    if(!merged)continue;
    merged.receiveShadows=true;merged.isPickable=false;
    if(root)merged.parent=root;
    if(!movingRoots.has(root))merged.freezeWorldMatrix();
    if(cast)shadow.addShadowCaster(merged);
  }
  const audience=createAudience(scene,seats,material),galleryAudience=createAudience(scene,gallerySeats,material);
  const applause=createApplause();
  let lastScore=[0,0],lastStatus='waiting',lastEvent=-100,lastPaint=-100,eventText='ESPERANDO SUJETOS';
  let displayMode='eliminations',remaining=10,lowQuality=false;
  function paint(time){
    const excited=time-lastEvent<2.35;
    const race=displayMode==='race';
    ctx.fillStyle=excited?'#33232b':'#122a32';ctx.fillRect(0,0,1024,384);ctx.strokeStyle=excited?'#bd755f':'#44867e';ctx.lineWidth=4;ctx.strokeRect(8,8,1008,368);
    ctx.fillStyle='#85d7c2';ctx.font='bold 30px Arial';ctx.fillText('INSTITUTO DE REBOTE POST MORTEM',36,55);
    ctx.fillStyle='#92aeb0';ctx.font='18px Arial';ctx.fillText(`ENSAYO 07    /    ${audience.count+(race?galleryAudience.count:0)} OBSERVADORES`,36,91);
    ctx.fillStyle='#dbe9da';ctx.font='bold 76px Arial';
    ctx.fillText(race?`${lastScore[0].toFixed(1)}  :  ${lastScore[1].toFixed(1)}`:String(remaining),36,207);
    ctx.fillStyle='#85d7c2';ctx.font='bold 18px Arial';ctx.fillText(race?'MENTA':'SUJETOS EN JUEGO',38,241);
    if(race){ctx.fillStyle='#ecab96';ctx.fillText('CORAL',252,241);}
    ctx.strokeStyle='#28505a';ctx.lineWidth=1;
    for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(520+i*38,120);ctx.lineTo(520+i*38,278);ctx.stroke();}
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(520,120+i*39);ctx.lineTo(960,120+i*39);ctx.stroke();}
    ctx.strokeStyle=excited?'#e7ae82':'#82cfc0';ctx.lineWidth=4;ctx.beginPath();
    for(let i=0;i<=438;i++){
      const a=i/438, pulse=Math.exp(-(((a-.37)*18)**2))*Math.sin(a*120);
      const y=excited&&a>.54?196:196+Math.sin(a*30)*7+pulse*(excited?69:43);
      if(i===0)ctx.moveTo(520+i,y);else ctx.lineTo(520+i,y);
    }
    ctx.stroke();
    ctx.fillStyle=excited?'#e7ae82':'#adcbca';ctx.font='bold 24px Arial';ctx.fillText(eventText,37,331);
    screen.update(true);lastPaint=time;
  }
  paint(0);
  return{
    setLowQuality(low){
      lowQuality=low;
      for(const effect of accentEffects)effect.setEnabled(!low&&displayMode==='eliminations');
    },
    setMode(mode){
      displayMode=mode;
      for(const effect of accentEffects)effect.setEnabled(!lowQuality&&mode==='eliminations');
      lastPaint=-100;
      for(const [name,layout] of Object.entries(layouts))layout.setEnabled(name===mode);
      galleryAudience.setVisible(mode==='race');
    },
    onSnapshot(snapshot){
      lastScore=snapshot.score||[0,0];lastStatus=snapshot.status;
      if(displayMode==='eliminations')remaining=snapshot.players.filter(p=>p.health>0).length;
      if(snapshot.events?.length){lastEvent=performance.now()/1000;eventText='SIN PULSO   /   BAJA REGISTRADA';audience.applaud(lastEvent);applause.play();lastPaint=-100;}
      else if(lastStatus==='waiting')eventText='ESPERANDO SUJETOS';
    },
    update(time,platformTime,lowQuality,mode,viewHeight){
      if(viewHeight===null||viewHeight<24)audience.update(time,lowQuality);
      if(mode==='race'){
        const galleryVisible=true;
        galleryAudience.setVisible(galleryVisible);
        if(galleryVisible)galleryAudience.update(time,lowQuality);
        for(const [index,level] of towerLevels.entries()){
          const levelBase=index*levelHeight;
          level.setEnabled(viewHeight===null||levelBase<viewHeight+(lowQuality?34:48)&&levelBase+levelHeight>viewHeight-44);
        }
        for(const {obstacle,root} of movingDecks)root.position[obstacle.motion.axis]=platformOffset(obstacle,platformTime);
      }
      if(time-lastEvent>2.35)eventText=lastStatus==='playing'?'ENSAYO EN CURSO · REGISTRANDO DATOS':lastStatus==='finished'?'ENSAYO FINALIZADO':'ESPERANDO SUJETOS';
      if(time-lastPaint>.35)paint(time);
    },
    enableAudio:applause.enable,impact:applause.impact,monitor:applause.monitor,mute:applause.mute,count:audience.count,
  };
}
