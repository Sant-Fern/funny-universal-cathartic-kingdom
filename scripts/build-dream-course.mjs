import {readFileSync,writeFileSync} from 'node:fs';

// Authored rooms and traversals, not a radial tower. Coordinates describe the
// real walkable furniture, shelves, cups and clockwork shared with the server.
const file=new URL('../shared/arena.json',import.meta.url),config=JSON.parse(readFileSync(file,'utf8'));
const race=config.race;
race.bounds={width:220,depth:180};race.startX=90;race.startZ=-48;race.summitHeight=248;
race.entry={x:82,z:-48,h:.6,w:6,d:8};
config.jumpMaxSpeed=14.2;config.pogo.bouncePower=.5;
const first=[
 [74,-48,1.8],[67,-48,3],[61,-48,5.2],[55,-48,7.4],[49,-48,9.6],
 [43,-48,11.8],[37,-48,14],[31,-48,16.2],[25,-48,18.4],[19,-48,20.6],
 [14,-43,22.8],[14,-36,24.2],[14,-30,26],[20,-26,28],[27,-24,29.5],
 [34,-24,31],[41,-24,32.5],[48,-24,34],[55,-24,35.5],[62,-24,37],
];
const chess=[
 [62,-14,40],[62,-6,40],[62,2,42],[70,6,44.5],[78,10,47],
 [86,14,49.5],[86,22,52],[86,30,54.5],[78,34,57],[70,34,59.5],
 [62,34,62],[54,34,64.5],[46,34,67],[38,34,69.5],[30,34,72],
 [30,42,74],[38,46,75],[46,46,76],[54,46,77],[62,46,78],
];
const positions=[first,chess,
 [[62,54],[62,62],[54,66],[46,66],[38,66],[30,66],[22,66],[14,62],[14,54],[14,46],[14,38],[14,30],[22,26],[30,26],[38,26],[46,26],[54,26],[62,26],[70,26],[78,26]].map(([x,z],i)=>[x,z,80+i*2]),
 [[86,26],[86,34],[86,42],[86,50],[78,54],[70,54],[62,54],[54,54],[46,54],[38,54],[30,54],[22,50],[22,42],[22,34],[22,26],[22,18],[30,14],[38,14],[46,14],[46,6]].map(([x,z],i)=>[x,z,121+i*2]),
 [[46,-2],[46,-10],[46,-18],[46,-26],[38,-30],[30,-30],[22,-30],[14,-30],[6,-26],[6,-18],[6,-10],[6,-2],[14,2],[22,2],[30,2],[38,-2],[38,-10],[30,-14],[22,-18],[14,-22]].map(([x,z],i)=>[x,z,162+i*2]),
 [[14,-30],[22,-34],[30,-34],[38,-34],[46,-34],[54,-34],[62,-30],[62,-22],[62,-14],[62,-6],[54,-2],[46,-2],[38,-2],[30,-2],[22,-2],[14,-2],[14,6],[6,10],[6,4],[6,-2]].map(([x,z],i)=>[x,z,Number((203+i*2.2).toFixed(2))]),
];
const names=['LA ESCALERA DE CAJONES','EL AJEDREZ ROTO','EL MAR DE TAZAS','LA BIBLIOTECA SIN FIN','LA RELOJERÍA IMPOSIBLE','EL BARRIO INVERTIDO'];
const labels={bed:'Cama monumental',drawer:'Cajón de la escalera',table:'Mesa gigante',book:'Libro abierto al vacío',suitcase:'Maleta gigante',chessboard:'Mesa de ajedrez',card:'Puente de naipes',domino:'Dominó suspendido',dice:'Dado gigante','chess-rook':'Torre de ajedrez','tea-tray':'Taza sin gravedad',plate:'Isla de porcelana',sugar:'Escalera de azúcar',chocolate:'Chocolate suspendido',clock:'Reloj monumental',gear:'Engranaje de latón',piano:'Escalinata de piano','inverted-house':'Casa invertida','door-step':'Umbral imposible',frame:'Espejo flotante',record:'Disco gigante'};
const path=[],structures=[];
function extra(pad,style,x,z,h,w,d,thickness){structures.push({style,x,z,h,w,d,thickness,step:pad.step,level:pad.level});}
positions.forEach((points,section)=>{
 race.sections[section].name=names[section];
 for(const [i,[x,z,h]] of points.entries()){
  const pad={x,z,h,w:6,d:6,thickness:.7,landing:i%5===0,step:section*20+i+1,level:section+1};
  if(section===0){
   pad.style=i===0?'bed':i>=2&&i<=9?'drawer':['suitcase','book','bed','table'][i%4];
   if(i===0)Object.assign(pad,{w:14,d:12,thickness:1.1});
   if(i>=2&&i<=9)Object.assign(pad,{w:6.4,d:12+(i-2)*1.5,thickness:h});
   if(i===10)Object.assign(pad,{style:'table',w:10,d:10,shape:'ellipse',thickness:.6});
   if(i>=11)Object.assign(pad,{w:i%2?6:8,d:5,thickness:.7});
   if(i===19)Object.assign(pad,{style:'table',w:12,d:18,thickness:.8});
  }else if(section===1){
   pad.style=i===0?'chessboard':['card','chess-rook','domino','dice'][i%4];
   if(i===0)Object.assign(pad,{w:26,d:14,thickness:1.1});
   if(pad.style==='chess-rook')Object.assign(pad,{w:7,d:7,thickness:5,shape:'ellipse'});
   if(pad.style==='domino')Object.assign(pad,{w:5,d:10,thickness:.65});
   if(pad.style==='dice')Object.assign(pad,{w:6,d:6,thickness:6});
   if(pad.style==='card')Object.assign(pad,{w:8,d:5,thickness:.2});
  }else if(section===2){
   pad.style=['tea-tray','sugar','plate','chocolate'][i%4];
   if(pad.style==='tea-tray'||pad.style==='plate')Object.assign(pad,{w:12,d:12+(i%3)*2,thickness:pad.style==='tea-tray'?5:1.2,shape:'ellipse'});
   if(pad.style==='sugar')Object.assign(pad,{w:6.5,d:6.5,thickness:6.5});
   if(pad.style==='chocolate')Object.assign(pad,{w:6,d:12,thickness:1.5});
  }else if(section===3){
   pad.style=i%3===0?'drawer':'book';
   Object.assign(pad,{w:i<4?7:6.5,d:i<4?7:10,thickness:i<4?Math.min(24,h-113):.8+(i%3)*.5});
  }else if(section===4){
   pad.style=i%3===0?'clock':i%3===1?'gear':'piano';
   if(pad.style==='clock'||pad.style==='gear')Object.assign(pad,{w:12,d:12,shape:'ellipse',thickness:pad.style==='gear'?2.4:.9});
   else Object.assign(pad,{w:6,d:10,thickness:1.1});
   if(i===6||i===14)pad.motion={axis:i===6?'z':'x',amplitude:.65,period:6.5,phase:0};
  }else{
   pad.style=i%4===0?'inverted-house':i%4===1?'door-step':i%4===2?'piano':'frame';
   Object.assign(pad,{w:6,d:6,thickness:pad.style==='inverted-house'?9:.5});
   if(pad.style==='inverted-house')Object.assign(pad,{w:12,d:8});
  }
  pad.label=labels[pad.style];path.push(pad);
  if(pad.style==='table'){
   for(const sx of [-1,1])for(const sz of [-1,1])extra(pad,'table-leg',x+sx*pad.w*.3,z+sz*pad.d*.3,h-pad.thickness,.5,.5,Math.min(18,h-pad.thickness));
  }
  if(pad.style==='gear')for(let tooth=0;tooth<12;tooth++){
   const angle=tooth*Math.PI/6;extra(pad,'gear-tooth',x+Math.cos(angle)*6,z+Math.sin(angle)*6,h,1.5,1.5,2.4);
  }
 }
});
// Large inhabited surfaces make the route a set of places, not 120 isolated pads.
structures.push({style:'library-floor',x:54,z:48,h:119.8,w:80,d:32,thickness:1.5,step:60,level:4});
race.path=path;race.structures=structures;
let output=JSON.stringify(config,null,2);
for(const key of ['structures','path']){
 const marker=`    "${key}": [`,start=output.indexOf(marker),end=output.indexOf('\n    ]',start)+6;
 const compact=marker+'\n'+race[key].map(o=>'      '+JSON.stringify(o)).join(',\n')+'\n    ]';
 output=output.slice(0,start)+compact+output.slice(end);
}
writeFileSync(file,output+'\n');
console.log(`Authored ${path.length} landings across ${race.bounds.width} × ${race.bounds.depth} m; summit ${race.summitHeight} m; ${structures.length} structural volumes per route.`);
