import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { SpotLight } from '@babylonjs/core/Lights/spotLight.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { config,heightAt,platformOffset } from '../../shared/physics.js';
import { createAudience,createApplause } from './audience.js';

export function createAuditorium({scene,material,box,bone,shadow}){
  const start=scene.meshes.length,casters=new Set(),seats=[];
  const {width,depth}=config, halfX=width/2,halfZ=depth/2;
  const ceilingLift=config.ceilingHeight-14.55;
  const roomX=halfX+14,roomZ=halfZ+15.1,railX=halfX+.27,railZ=halfZ+.28;
  const wall='#263844',steel='#607b85',dark='#152531',trim='#3a5360',light='#d9e8e5';
  const lab=(name,size,pos,hex=wall,cast=false)=>{const mesh=box(name,size,pos,hex);if(cast)casters.add(mesh);return mesh;};
  const glow=(name,size,pos,hex='#73ccbd')=>{const mesh=lab(name,size,pos,hex);mesh.material=material(hex,true);return mesh;};
  const glass=new StandardMaterial('vidrio-de-observacion',scene);glass.diffuseColor=Color3.FromHexString('#6ea4b0');glass.specularColor=new Color3(.6,.75,.8);glass.alpha=.20;glass.backFaceCulling=false;glass.disableDepthWrite=true;
  const floorTexture=new DynamicTexture('losetas-del-laboratorio',{width:512,height:512},scene,false),f=floorTexture.getContext();
  const enamel=f.createLinearGradient(0,0,512,512);
  enamel.addColorStop(0,'#627c82');enamel.addColorStop(.48,'#516971');enamel.addColorStop(1,'#5c747a');
  f.fillStyle=enamel;f.fillRect(0,0,512,512);f.strokeStyle='#283942';f.lineWidth=9;f.strokeRect(0,0,512,512);
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
  for(const o of config.obstacles){
    if(o.thickness||o.motion)continue;
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
  markings.hasAlpha=true;markings.update(true);
  const decal=new StandardMaterial('tinta-y-sombra-de-contacto',scene);
  decal.diffuseTexture=markings;decal.emissiveTexture=markings;
  decal.diffuseColor=Color3.Black();decal.useAlphaFromDiffuseTexture=true;
  decal.disableLighting=true;decal.disableDepthWrite=true;
  const floorDetail=MeshBuilder.CreateGround('marcado-del-ensayo',{width,height:depth},scene);
  floorDetail.position.y=.014;floorDetail.material=decal;floorDetail.isPickable=false;
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
  const amber='#efbd72',landingMetal='#34454d';
  const deckSigns={
    1:['01','IMPULSO',amber],2:['02','RELEVO',amber],3:['03','MIRADOR',amber],
    direct:['A','ATAJO','#f3a177'],covered:['B','CUBIERTA','#82d7cc'],
    station:['04','ESTACIÓN','#e9c58a'],summit:['05','CIMA','#fbe19c'],shuttle:['↔','MÓVIL','#c8b7ff'],
  };
  const signMaterials=new Map();
  for(const [key,[number,label,tint]] of Object.entries(deckSigns)){
    const texture=new DynamicTexture('placa-de-nivel-'+label,{width:512,height:128},scene,false);
    const ctx=texture.getContext();
    ctx.fillStyle='#182930';ctx.fillRect(0,0,512,128);
    ctx.fillStyle=tint;ctx.fillRect(0,0,104,128);
    ctx.fillStyle='#192b31';ctx.font='bold 68px Arial';ctx.fillText(number,number.length===1?29:12,87);
    ctx.fillStyle=tint;ctx.font='bold 48px Arial';ctx.fillText(label,130,81);
    ctx.strokeStyle=tint;ctx.lineWidth=4;ctx.strokeRect(2,2,508,124);
    texture.update(true);
    const plate=new StandardMaterial('senal-'+label,scene);
    plate.emissiveTexture=texture;plate.diffuseColor=Color3.Black();plate.disableLighting=true;
    signMaterials.set(key,plate);
  }
  const deckSign=(key,x,y,z,yaw,width)=>{
    const plate=MeshBuilder.CreatePlane('senal-de-altura',{width:Math.min(1.68,width-.18),height:.27},scene);
    plate.position.set(x,y,z);plate.rotation.y=yaw;plate.material=signMaterials.get(key);
  };
  function buildDeck(o){
    const {x,z,w,d,h,tier,route}=o,ground=heightAt(x,z),top=ground+h;
    const thickness=o.thickness??h,base=top-thickness;
    const key=String(route??tier),tint=deckSigns[key][2];
    lab('plataforma-suspendida',[w,thickness,d],[x,base+thickness/2,z],landingMetal,true);
    lab('placa-de-aterrizaje',[w,.095,d],[x,top-.048,z],route==='summit'||tier===3?'#687d82':'#536871',true);
    lab('bastidor-inferior',[w*.72,.11,d*.72],[x,base-.025,z],'#263b44');
    for(const side of [-1,1]){
      const xFace=x+side*w/2,zFace=z+side*d/2;
      glow('borde-de-aterrizaje',[w-.20,.012,.055],[x,top+.009,zFace-side*.085],tint);
      glow('borde-de-aterrizaje',[.055,.012,d-.20],[xFace-side*.085,top+.009,z],tint);
      deckSign(key,x,top-.24,zFace+side*.013,side>0?Math.PI:0,w);
      deckSign(key,xFace+side*.013,top-.24,z,side>0?-Math.PI/2:Math.PI/2,d);
      if(route){
        glow('cinta-de-ruta',[w-.22,.035,.026],[x,top-.13,zFace+side*.02],tint);
        glow('cinta-de-ruta',[.026,.035,d-.22],[xFace+side*.02,top-.13,z],tint);
      }
      for(const off of [-1,1]){
        lab('refuerzo-de-cubierta',[.14,thickness-.07,.035],[x+off*(w/2-.16),base+thickness/2,zFace+side*.016],steel);
        lab('refuerzo-de-cubierta',[.035,thickness-.07,.14],[xFace+side*.016,base+thickness/2,z+off*(d/2-.16)],steel);
      }
      for(let i=-2;i<=2;i++){
        glow('chevron-de-aterrizaje',[.12,.012,.38],[x+i*.24,top+.009,zFace-side*.28],i%2?dark:tint).rotation.y=side*.52;
        glow('chevron-de-aterrizaje',[.38,.012,.12],[xFace-side*.28,top+.009,z+i*.24],i%2?dark:tint).rotation.y=-side*.52;
      }
    }
    if(tier===1){
      const dx=Math.sign(x),dz=Math.sign(z);
      for(let i=0;i<3;i++)for(const side of [-1,1]){
        const edge=(dx?w:d)/2+.6+i*.48;
        const arrow=glow('guia-de-impulso',[.065,.012,.49],
          [x+dx*edge+dz*side*.16,ground+.022,z+dz*edge+dx*side*.16],amber);
        arrow.rotation.y=(dx?Math.PI/2:0)-side*(dx||-dz)*.72;
      }
    }
  }
  // Visible decks and instrument benches use the shared collision volumes.
  const movingDecks=[];
  config.obstacles.forEach((o,i)=>{
    if(o.tier||o.route){
      const firstMesh=scene.meshes.length;
      buildDeck(o);
      if(o.motion){
        movingDecks.push({obstacle:o,meshes:scene.meshes.slice(firstMesh),root:new TransformNode('transbordador',scene)});
        for(const end of [-1,1]){
          const offset=end*o.motion.amplitude;
          const x=o.x+(o.motion.axis==='x'?offset:0);
          const z=o.z+(o.motion.axis==='z'?offset:0);
          glow('baliza-de-recorrido',[.13,.12,.13],[x,o.h-.68,z],'#a99ad9');
        }
      }
      return;
    }
    const y=heightAt(o.x,o.z);
    if(o.routeCover){
      const thickness=o.thickness??o.h;
      lab('blindaje-de-ascenso',[o.w,thickness,o.d],[o.x,y+o.h-thickness/2,o.z],'#243b46',true);
      for(const side of [-1,1]){
        lab('refuerzo-del-blindaje',[o.w,.13,o.d],[o.x,y+o.h-.09,o.z],'#59777c',true);
        glow('luz-de-blindaje',[.025,.04,o.d-.25],[o.x+side*(o.w/2+.012),y+o.h-.23,o.z],'#82d7cc');
      }
      return;
    }
    lab('mesa-de-ensayo',[o.w,o.h,o.d],[o.x,y+o.h/2,o.z],'#52616d',true);
    lab('cubierta-metalica',[o.w,.105,o.d],[o.x,y+o.h-.0525,o.z],'#92a9a7',true);
    for(const side of [-1,1]){
      const front=o.z+side*(o.d/2+.012);
      lab('puerta-de-instrumentos',[o.w-.25,o.h*.64,.028],[o.x,y+o.h*.42,front],dark,true);
      glow('estado-instrumentos',[o.w*.48,.035,.025],[o.x,y+o.h*.78,front+side*.02],i%2?'#d9aa6f':'#7bc8bd');
      for(let c=-1;c<=1;c++)lab('tirador',[.19,.047,.049],[o.x+c*o.w*.21,y+o.h*.53,front+side*.03],light);
    }
    for(const side of [-1,1])lab('moldura-esquina',[.13,o.h,.13],[o.x+side*(o.w/2-.06),y+o.h/2,o.z-o.d/2+.05],steel);
  });
  for(const team of [0,1]){
    const x=(team?1:-1)*config.spawnX,hex=team?'#e39b84':'#80d5b8';
    const ring=MeshBuilder.CreateTorus('zona-de-entrada',{diameter:5.6,thickness:.055,tessellation:56},scene);ring.position.set(x,.033,0);ring.material=material(hex,true);
    for(const z of [-2.5,2.5])glow('esquina-de-zona',[.62,.018,.12],[x,.021,z],hex);
  }
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
  lab('techo-acustico',[roomX*2+.8,.5,roomZ*2+.1],[0,config.ceilingHeight,0],dark);
  for(let x=-40;x<=40;x+=10)lab('viga-de-techo',[.52,.48,roomZ*2],[x,14.14+ceilingLift,0],trim);
  for(const z of [-30,-15,0,15,30])for(const x of [-32,-16,0,16,32]){
    lab('marco-de-luminaria',[8,.29,2.6],[x,13.75+ceilingLift,z],steel);
    glow('difusor-quirurgico',[7.62,.10,2.22],[x,13.55+ceilingLift,z],Math.abs(x)>=32?'#7296a3':'#a5bfc1');
    for(const off of [-.76,0,.76])lab('rejilla',[7.52,.045,.037],[x,13.46+ceilingLift,z+off],light);
  }
  function surgicalLamp(name,x,y,z,hex,direction,intensity){
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

  // Batch the static architecture while keeping glass surfaces individually sorted.
  const movingMeshes=new Map(movingDecks.flatMap(({root,meshes})=>meshes.map(mesh=>[mesh,root])));
  const groups=new Map();
  for(const mesh of scene.meshes.slice(start)){
    if(mesh.material===glass||mesh.material===screenMat||hazeMaterials.has(mesh.material)||mesh===mainFloor||mesh===floorDetail||!mesh.getTotalVertices())continue;
    const key=`${mesh.material.uniqueId}:${casters.has(mesh)}:${movingMeshes.get(mesh)?.uniqueId??'static'}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  }
  for(const meshes of groups.values()){
    const first=meshes[0],cast=casters.has(first),movingRoot=movingMeshes.get(first);
    const merged=meshes.length>1?Mesh.MergeMeshes(meshes,true,true):first;
    if(!merged)continue;
    merged.receiveShadows=true;merged.isPickable=false;
    if(movingRoot)merged.parent=movingRoot;
    else merged.freezeWorldMatrix();
    if(cast)shadow.addShadowCaster(merged);
  }
  const audience=createAudience(scene,seats,material),applause=createApplause();
  let lastScore=[0,0],lastStatus='waiting',lastEvent=-100,lastPaint=-100,eventText='ESPERANDO SUJETOS';
  function paint(time){
    const excited=time-lastEvent<2.35;
    ctx.fillStyle=excited?'#33232b':'#122a32';ctx.fillRect(0,0,1024,384);ctx.strokeStyle=excited?'#bd755f':'#44867e';ctx.lineWidth=4;ctx.strokeRect(8,8,1008,368);
    ctx.fillStyle='#85d7c2';ctx.font='bold 30px Arial';ctx.fillText('INSTITUTO DE REBOTE POST MORTEM',36,55);
    ctx.fillStyle='#92aeb0';ctx.font='18px Arial';ctx.fillText(`ENSAYO 07    /    ${audience.count} OBSERVADORES`,36,91);
    ctx.fillStyle='#dbe9da';ctx.font='bold 76px Arial';ctx.fillText(`${lastScore[0]}   :   ${lastScore[1]}`,36,207);
    ctx.fillStyle='#85d7c2';ctx.font='bold 18px Arial';ctx.fillText('MENTA',38,241);ctx.fillStyle='#ecab96';ctx.fillText('CORAL',211,241);
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
    onSnapshot(snapshot){
      lastScore=snapshot.score||[0,0];lastStatus=snapshot.status;
      if(snapshot.events?.length){lastEvent=performance.now()/1000;eventText='SIN PULSO   /   BAJA REGISTRADA';audience.applaud(lastEvent);applause.play();lastPaint=-100;}
      else if(lastStatus==='waiting')eventText='ESPERANDO SUJETOS';
    },
    update(time,platformTime){
      audience.update(time);
      for(const {obstacle,root} of movingDecks){
        root.position[obstacle.motion.axis]=platformOffset(obstacle,platformTime);
      }
      if(time-lastEvent>2.35)eventText=lastStatus==='playing'?'ENSAYO EN CURSO · REGISTRANDO DATOS':lastStatus==='finished'?'ENSAYO FINALIZADO':'ESPERANDO SUJETOS';
      if(time-lastPaint>.35)paint(time);
    },
    enableAudio:applause.enable,impact:applause.impact,monitor:applause.monitor,mute:applause.mute,count:audience.count,
  };
}
