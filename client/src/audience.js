import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { Matrix,Quaternion,Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';

const up=new Vector3(0,1,0),ivory='#e5eeee',skins=['#d6ad8d','#a47860','#815c49','#e2baa1','#b89073'];
export function createAudience(scene,seats,material){
  const staticBatches=[],movingBatches=[],mat=material;
  function batch(name,geometry,matName,moving=false){
    const mesh=geometry==='box'?MeshBuilder.CreateBox(name,{size:1},scene):geometry==='sphere'
      ?MeshBuilder.CreateSphere(name,{diameter:1,segments:7},scene):MeshBuilder.CreateCylinder(name,{height:1,diameter:1,tessellation:8},scene);
    mesh.material=typeof matName==='string'?mat(matName):matName;mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;
    const b={mesh,moving,matrices:[],buffer:null,offset:0};
    (moving?movingBatches:staticBatches).push(b);
    return b;
  }
  const clipboardTexture=new DynamicTexture('hojas-de-observacion',{width:128,height:192},scene,false);
  const c=clipboardTexture.getContext();c.fillStyle='#d9e4dd';c.fillRect(0,0,128,192);c.fillStyle='#49676d';c.fillRect(12,14,104,20);
  c.fillStyle='#f2f6ef';c.font='bold 10px Arial';c.fillText('OBSERVACIONES',19,28);
  for(let y=47;y<174;y+=16){c.fillStyle='#8caca9';c.fillRect(16,y,96,1);c.fillStyle='#4c696d';c.fillRect(18,y-7,22+(y%29),2);c.fillRect(68,y-6,33,2);}
  clipboardTexture.update(true);
  const paper=new StandardMaterial('tabla-clinica',scene);paper.diffuseTexture=clipboardTexture;paper.specularColor=Color3.Black();
  const coats=batch('batas','cylinder',ivory),collars=batch('solapas','box','#f8fbf3'),pants=batch('pantalones','box','#546779');
  const shoes=batch('zapatos','box','#24333b'),undershirt=batch('uniformes','box','#678d91'),hair=batch('cabello','sphere','#514943');
  const glasses=batch('lentes','box','#3d5359'),heads=skins.map((hex,i)=>batch(`rostro-${i}`,'sphere',hex));
  const sleeves=batch('mangas-animadas','cylinder',ivory,true),hands=skins.map((hex,i)=>batch(`mano-${i}`,'sphere',hex,true));
  const boards=batch('tablas-de-observacion','box',paper,true),pens=batch('boligrafos','cylinder','#46767b',true);
  const rot=new Quaternion(),scale=new Vector3(),matrix=new Matrix();
  const start=new Vector3(),end=new Vector3(),axis=new Vector3();
  function pointToRef(d,x,y,z,result){
    result.set(d.x+x*d.c+z*d.s,d.y+y,d.z-x*d.s+z*d.c);
  }
  function writeMatrix(b){
    matrix.copyToArray(b.buffer??b.matrices,b.offset);
    b.offset+=16;
  }
  function instance(b,d,x,y,z,sx,sy,sz,rx=0,rz=0){
    pointToRef(d,x,y,z,start);
    Matrix.ComposeToRef(scale.set(sx,sy,sz),Quaternion.RotationYawPitchRollToRef(d.yaw,rx,rz,rot),start,matrix);
    writeMatrix(b);
  }
  function limb(b,d,ax,ay,az,ex,ey,ez,width){
    pointToRef(d,ax,ay,az,start);
    pointToRef(d,ex,ey,ez,end);
    end.subtractToRef(start,axis);
    const length=axis.length();
    Quaternion.FromUnitVectorsToRef(up,axis.normalize(),rot);
    Matrix.ComposeToRef(scale.set(width,length,width),rot,start.addInPlace(end).scaleInPlace(.5),matrix);
    writeMatrix(b);
  }
  const doctors=seats.map((seat,i)=>{
    const yaw=Math.atan2(-seat.x,-seat.z);
    return{...seat,index:i,yaw,c:Math.cos(yaw),s:Math.sin(yaw),skin:i%skins.length,cohort:i%3,phase:(i*2.39996)%(Math.PI*2)};
  });
  // Keep seats from every stand in the first quarter for the low graphics preset.
  doctors.sort((a,b)=>(a.index%4)-(b.index%4));
  const lowCount=Math.ceil(doctors.length/4);
  for(const [position,d]of doctors.entries()){
    const i=d.index;
    instance(coats,d,0,.91,0,.49,.68,.34);
    instance(undershirt,d,0,1.10,.171,.18,.23,.028);
    instance(collars,d,-.095,1.095,.185,.09,.25,.029,0,-.37);instance(collars,d,.095,1.095,.185,.09,.25,.029,0,.37);
    instance(heads[d.skin],d,0,1.37,.045,.238,.29,.23);
    if(i%7!==0)instance(hair,d,0,1.472,.022,.241,.112,.23);
    if(i%4===0){instance(glasses,d,-.062,1.397,.155,.09,.034,.016);instance(glasses,d,.062,1.397,.155,.09,.034,.016);instance(glasses,d,0,1.397,.163,.05,.011,.012);}
    for(const side of [-1,1]){
      instance(pants,d,side*.132,.48,.19,.16,.16,.44);
      instance(pants,d,side*.132,.25,.365,.145,.44,.145);
      instance(shoes,d,side*.132,.07,.42,.16,.10,.26);
    }
    if(position+1===lowCount){
      for(const b of staticBatches)b.lowCount=b.offset/16;
    }
  }
  function upload(b){
    if(!b.offset){b.mesh.setEnabled(false);return;}
    if(!b.buffer){
      b.buffer=new Float32Array(b.matrices);
      b.matrices=null;
      b.mesh.thinInstanceSetBuffer('matrix',b.buffer,16,!b.moving);
      b.mesh.thinInstanceRefreshBoundingInfo();
    }else b.mesh.thinInstanceBufferUpdated('matrix');
  }
  for(const b of staticBatches)upload(b);
  let applauseUntil=-1,last=-1,writingCohort=0,previousLow=false;
  function update(time,lowQuality=false){
    if(lowQuality!==previousLow){
      for(const b of staticBatches)b.mesh.thinInstanceCount=lowQuality?b.lowCount:b.offset/16;
      previousLow=lowQuality;
    }else if(time-last<(lowQuality ? .09 : .045))return;
    last=time;
    for(const b of movingBatches)b.offset=0;
    const count=lowQuality?lowCount:doctors.length;
    for(let i=0;i<count;i++){
      const d=doctors[i];
      const clap=time<applauseUntil&&d.cohort!==writingCohort;
      const excitement=clap?Math.sin(time*17+d.phase)*.045:0;
      const separation=.047+.17*(.5+.5*Math.cos(time*23+d.phase));
      for(const side of [-1,1]){
        const elbowY=clap?1.08+excitement:.88;
        const handX=clap?side*separation:side*.13+(side>0?Math.sin(time*5+d.phase)*.077:0);
        const handY=clap?1.22+excitement:.87+(side>0?Math.sin(time*9+d.phase)*.018:0);
        const handZ=clap?.43:.455;
        limb(sleeves,d,side*.235,1.14,0,side*.31,elbowY,.14,.143);
        limb(sleeves,d,side*.31,elbowY,.14,handX,handY,handZ,.112);
        instance(hands[d.skin],d,handX,handY,handZ,.087,.106,.076,clap?-.17:.38);
        if(side>0)limb(pens,d,handX,handY+.045,handZ,handX+.025,handY-.09,handZ+.035,.016);
      }
      instance(boards,d,0,clap?.61:.81,clap?.34:.44,.34,.40,.028,clap?-1.25:-.64);
    }
    for(const b of movingBatches){
      upload(b);
      b.mesh.thinInstanceCount=b.offset/16;
    }
  }
  update(0);
  return{update,applaud(time){applauseUntil=time+2.35;writingCohort=(writingCohort+1)%3;},count:doctors.length};
}

export function createApplause(){
  let context=null,noise=null,muted=false,last=-1,lastImpact=-1;
  function enable(){
    try{
      context||=new AudioContext();
      if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.11),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
      if(context.state==='suspended')context.resume().catch(()=>{});
    }catch{}
  }
  function play(){
    if(muted||!noise||context.state!=='running'||context.currentTime-last<.55)return;
    last=context.currentTime;
    for(let i=0;i<13;i++){
      const src=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      const at=last+i*.052+Math.random()*.052;src.buffer=noise;src.playbackRate.value=.80+Math.random()*.5;
      filter.type='bandpass';filter.frequency.value=1350+Math.random()*550;filter.Q.value=.6;
      gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(.04,at+.007);gain.gain.exponentialRampToValueAtTime(.001,at+.075);
      src.connect(filter).connect(gain).connect(context.destination);src.start(at);src.stop(at+.1);
    }
  }
  function impact(hit,volume,local,heavy=false,down=false){
    if(muted||!noise||context.state!=='running'||volume<.005)return;
    const at=context.currentTime;
    if(!local&&at-lastImpact<.075)return;
    lastImpact=at;
    const glass=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    glass.buffer=noise;
    glass.playbackRate.value=heavy?.82:hit?1.15:1.45;
    filter.type='bandpass';
    filter.frequency.value=hit?1050:4300;
    filter.Q.value=hit?.7:1.3;
    gain.gain.setValueAtTime(volume,at);
    gain.gain.exponentialRampToValueAtTime(.001,at+.065);
    glass.connect(filter).connect(gain).connect(context.destination);
    glass.start(at);
    if(hit){
      const knock=context.createOscillator(),knockGain=context.createGain();
      knock.type='triangle';
      knock.frequency.setValueAtTime(heavy?165:260,at);
      knock.frequency.exponentialRampToValueAtTime(heavy?63:105,at+.072);
      knockGain.gain.setValueAtTime(volume*(heavy?1.35:1.05),at);
      knockGain.gain.exponentialRampToValueAtTime(.001,at+.13);
      knock.connect(knockGain).connect(context.destination);
      knock.start(at);
      knock.stop(at+.14);
    }
    if(down)monitor(local?.038:volume*.23);
  }
  function monitor(volume=.045){
    if(muted||!context||context.state!=='running')return;
    const at=context.currentTime+.055;
    const signal=context.createOscillator(),level=context.createGain();
    signal.type='sine';
    signal.frequency.setValueAtTime(730,at);
    signal.frequency.setValueAtTime(512,at+.10);
    level.gain.setValueAtTime(.001,at);
    level.gain.linearRampToValueAtTime(volume,at+.018);
    level.gain.setValueAtTime(volume*.75,at+.19);
    level.gain.exponentialRampToValueAtTime(.001,at+.40);
    signal.connect(level).connect(context.destination);
    signal.start(at);signal.stop(at+.41);
  }
  return{enable,play,impact,monitor,mute(value){muted=value;if(!muted)enable();}};
}
