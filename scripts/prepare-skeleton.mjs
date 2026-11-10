// Adaptation of Écorché anatomical meshes; see client/public/models/ATTRIBUTION.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MeshoptSimplifier } from 'meshoptimizer';

const lowDetail = process.argv.includes('--low-detail');
const ratio = lowDetail ? .075 : .30;
const maxError = lowDetail ? .04 : .003;
const raw = readFileSync(new URL('../assets/sources/ecorche.glb', import.meta.url));
const jsonSize = raw.readUInt32LE(12), src = JSON.parse(raw.subarray(20, 20+jsonSize));
const binary = raw.subarray(28+jsonSize);
const sizes = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 };
const components = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 };
const reads = { 5120:'readInt8',5121:'readUInt8',5122:'readInt16LE',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE' };
function attribute(index) {
  const a=src.accessors[index],view=src.bufferViews[a.bufferView],n=components[a.type],step=sizes[a.componentType];
  const out=new Float32Array(a.count*n), stride=view.byteStride||n*step;
  for(let i=0;i<a.count;i++)for(let j=0;j<n;j++){
    let value=binary[reads[a.componentType]]((view.byteOffset||0)+(a.byteOffset||0)+i*stride+j*step);
    if(a.normalized)value=Math.max(-1,value/(a.componentType===5120?127:a.componentType===5121?255:a.componentType===5122?32767:65535));
    out[i*n+j]=value;
  }
  return out;
}
const definitions={
  torso:{pivot:[0,0,0]}, head:{pivot:[0,2.47,.02]},
  upperArmR:{pivot:[-.23,2.32,0]},forearmR:{pivot:[-.29,1.94,.02],parent:'upperArmR'},
  upperArmL:{pivot:[.23,2.32,0]},forearmL:{pivot:[.29,1.94,.02],parent:'upperArmL'},
  thighR:{pivot:[-.12,1.70,0]},shinR:{pivot:[-.13,1.16,.02],parent:'thighR'},
  thighL:{pivot:[.12,1.70,0]},shinL:{pivot:[.13,1.16,.02],parent:'thighL'},
};
const groups=Object.fromEntries(Object.keys(definitions).map(k=>[k,{p:[],n:[],c:[],i:[]}]));
const hand=['finger','thumb','metacarp','capitate','hamate','lunate','pisiform','scaphoid','trapezium','trapezoid'];
const foot=['toe','metatars','calcaneus','cuboid','cuneiform','talus','navicular','foot'];
let structures=0,sourceTriangles=0;
for(const node of src.nodes){
  const e=node.extras||{},name=(node.name||'').toLowerCase();
  if(node.mesh===undefined||e.layer!=='skeleton'||e.tissue==='eye')continue;
  if(e.tissue==='cartilage'&&!/costal|intervertebral/.test(name))continue;
  const side=name.includes('right')?'R':name.includes('left')?'L':null;
  let key='torso';
  if(side){
    if(name.includes('humerus'))key=`upperArm${side}`;
    else if(/radius|ulna/.test(name)||hand.some(x=>name.includes(x)))key=`forearm${side}`;
    else if(name.includes('femur'))key=`thigh${side}`;
    else if(/tibia|fibula|patella/.test(name)||foot.some(x=>name.includes(x)))key=`shin${side}`;
  }
  if(key==='torso'&&(/mandible|maxilla|frontal|parietal|occipital|temporal|sphenoid|ethmoid|zygomatic|nasal|palatine|lacrimal|vomer|tooth|incisor|molar|canine/.test(name)))key='head';
  const g=groups[key],pivot=definitions[key].pivot;
  for(const p of src.meshes[node.mesh].primitives){
    const positions=attribute(p.attributes.POSITION),normals=attribute(p.attributes.NORMAL),colors=attribute(p.attributes.COLOR_0),indices=attribute(p.indices);
    const offset=g.p.length/3;
    for(let i=0;i<positions.length;i+=3){
      g.p.push(positions[i]*.00012-pivot[0],positions[i+1]*.00012+.62-pivot[1],positions[i+2]*.00012-pivot[2]);
      g.n.push(normals[i],normals[i+1],normals[i+2]);
      const index=i/3*4,ao=Math.max(.35,(colors[index]+colors[index+1]+colors[index+2])/3);
      g.c.push(ao*.96,ao*.92,ao*.81,1);
    }
    for(const i of indices)g.i.push(i+offset);
    sourceTriangles+=indices.length/3;
  }
  structures++;
}
await MeshoptSimplifier.ready;
const out={asset:{version:'2.0',generator:'Funny Universal Cathartic Kingdom · anatomical adaptation',copyright:'Écorché; BodyParts3D; Z-Anatomy. CC BY-SA 4.0'},
  scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:'Aged ivory',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.68}}],buffers:[{}],bufferViews:[],accessors:[]};
const chunks=[];let offset=0,triangles=0;
function add(data,type,componentType,min,max){
  const bytes=Buffer.from(data.buffer,data.byteOffset,data.byteLength),view=out.bufferViews.length;
  out.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});
  chunks.push(bytes);offset+=bytes.length;
  const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
  const a={bufferView:view,componentType,count:data.length/components[type],type};if(min)a.min=min;if(max)a.max=max;
  out.accessors.push(a);return out.accessors.length-1;
}
const nodeIndexes={};
for(const [name,g]of Object.entries(groups)){
  const positions=new Float32Array(g.p),original=new Uint32Array(g.i);
  const target=Math.max(12,Math.floor(original.length*ratio/3)*3);
  const [indices]=MeshoptSimplifier.simplify(original,positions,3,Math.min(original.length,target),maxError,lowDetail?[]:['LockBorder']);
  const [remap,count]=MeshoptSimplifier.compactMesh(indices);
  const p=new Float32Array(count*3),n=new Float32Array(count*3),c=new Uint8Array(count*4);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let old=0;old<remap.length;old++){
    const dest=remap[old];if(dest===0xffffffff)continue;
    for(let axis=0;axis<3;axis++){const v=g.p[old*3+axis];p[dest*3+axis]=v;n[dest*3+axis]=g.n[old*3+axis];min[axis]=Math.min(min[axis],v);max[axis]=Math.max(max[axis],v);}
    for(let j=0;j<4;j++)c[dest*4+j]=Math.round(g.c[old*4+j]*255);
  }
  const attributes={POSITION:add(p,'VEC3',5126,min,max),NORMAL:add(n,'VEC3',5126),COLOR_0:add(c,'VEC4',5121)};
  out.accessors[attributes.COLOR_0].normalized=true;
  out.meshes.push({name,primitives:[{attributes,indices:add(indices,'SCALAR',5125),material:0}]});
  const def=definitions[name],parentPivot=definitions[def.parent]?.pivot||[0,0,0];
  nodeIndexes[name]=out.nodes.length;
  out.nodes.push({name,mesh:out.meshes.length-1,translation:def.pivot.map((x,i)=>x-parentPivot[i])});
  triangles+=indices.length/3;
}
for(const [name,def]of Object.entries(definitions)){
  if(def.parent){const parent=out.nodes[nodeIndexes[def.parent]];(parent.children||=[]).push(nodeIndexes[name]);}
  else out.scenes[0].nodes.push(nodeIndexes[name]);
}
out.buffers[0].byteLength=offset;
let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const bin=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);
binHeader.writeUInt32LE(bin.length);binHeader.write('BIN\0',4);
const dest=new URL('../client/public/models/',import.meta.url);mkdirSync(dest,{recursive:true});
writeFileSync(new URL(lowDetail?'anatomical-skeleton-low.glb':'anatomical-skeleton.glb',dest),Buffer.concat([header,json,binHeader,bin]));
const stats={source:'https://github.com/Charleeh/ecorche',sourceSha256:createHash('sha256').update(raw).digest('hex'),license:'CC BY-SA 4.0',structures,sourceTriangles,triangles,bytes:28+json.length+bin.length,changes:'Skeleton only; eyes and soft nasal/ear tissue removed; AO tint converted to aged ivory; scale, rigid joint grouping and mesh simplification for game animation.'};
writeFileSync(new URL(lowDetail?'skeleton-low-manifest.json':'skeleton-manifest.json',dest),JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify(stats,null,2));
