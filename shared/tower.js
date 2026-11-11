import config from './arena.json' with { type: 'json' };

// Authored landing coordinates shared verbatim with the authoritative server.
const {path,rise,sections,stepsPerSection,entry}=config.race;
export const towerTracks=[-1,1].map((side,lane)=>path.map((pad,i)=>({
  ...pad,x:pad.x*side,z:pad.z*side,h:Number(((i+1)*rise).toFixed(2)),
  step:i+1,lane,level:Math.min(sections.length,Math.floor(i/stepsPerSection)+1),
  ...(pad.motion?{motion:{...pad.motion,phase:lane*Math.PI}}:{}),
})));
export const summit={x:0,z:0,h:Number(((path.length+1)*rise).toFixed(2)),
  w:6,d:6,thickness:.9,step:path.length+1,level:sections.length,route:'summit'};
export const towerEntries=[-1,1].map((side,lane)=>({
  ...entry,x:entry.x*side,lane,level:1,step:0,
}));
export const towerObstacles=[...towerEntries,...towerTracks.flat(),summit,
  {...config.towerCore,h:Number(((path.length-3)*rise).toFixed(2)),core:true}];
export function nextTowerPad(player){
  const step=player.raceStep??-1;
  if(step<0)return towerEntries[player.team??0];
  if(step===0)return towerTracks[player.x<0?0:1][0];
  if(step>=path.length)return summit;
  const distance=track=>Math.hypot(player.x-track[step-1].x,player.z-track[step-1].z);
  return towerTracks[distance(towerTracks[0])<=distance(towerTracks[1])?0:1][step];
}
