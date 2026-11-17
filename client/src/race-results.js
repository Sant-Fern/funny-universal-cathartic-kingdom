export function formatRaceTime(seconds){
  const hundredths=Math.round(seconds*100);
  return `${Math.floor(hundredths/6000)}:${String(Math.floor(hundredths/100)%60).padStart(2,'0')},${String(hundredths%100).padStart(2,'0')}`;
}

export function raceTeams(snapshot){
  return [0,1].map(team=>{
    const players=snapshot.players.filter(p=>p.team===team).sort((a,b)=>
      (a.finishPosition??Infinity)-(b.finishPosition??Infinity)||b.bestHeight-a.bestHeight||a.id.localeCompare(b.id));
    return {team,players,points:players.reduce((total,p)=>total+(p.racePoints??0),0),
      arrived:players.filter(p=>p.finishPosition!=null).length};
  });
}
