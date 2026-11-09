import './style.css';
import { createWorld } from './world.js';
import { bindMouseControls } from './mouse-controls.js';
import { config } from '../../shared/physics.js';

const $=id=>document.getElementById(id);
const canvas=$('arena');
let world;
let mouse;
try {
  world=await createWorld(canvas, dt=>mouse?.advance(dt));
  $('loading').hidden=true;
} catch(error) {
  $('loading').textContent='No se pudo preparar la escena 3D. Recarga el juego y revisa la consola.';
  console.error(error);
  throw error;
}

let socket=null,playerId=null,snapshot=null,inputSeq=0,lastSnapshotAt=0;
let connecting=false,requestId=0,muted=false;
const keys=new Set();
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
const arrowSteps={ArrowLeft:[-28,0],ArrowRight:[28,0],ArrowUp:[0,-22],ArrowDown:[0,22]};
let charging=false,chargeStarted=0,chargeSource=null,throwPending=null,throwPower=.6;
let bottle='standard',hitTimer;
let lastDamage=-100;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let jumpStarted=null,jumpPending=null;
try{$('nickname').value=localStorage.getItem('pogo-name')||'Huesitos';}catch{}

function controlsActive(){return Boolean(playerId)&&snapshot?.status!=='finished';}
function clearJump(){jumpStarted=null;jumpPending=null;world.setJumpCharge(null);}
function clearControls(){keys.clear();mouse.reset();charging=false;chargeSource=null;throwPending=null;clearJump();world.setCharge(throwPower,false);}
const jumpCharge=()=>Math.min(1,(performance.now()-jumpStarted)/(config.jumpChargeSeconds*1000));
function startCharge(source){
  if(charging||!playerId||snapshot?.status==='finished'||snapshot?.players.find(p=>p.id===playerId)?.health===0)return;
  charging=true;chargeSource=source;chargeStarted=performance.now();
}
function releaseCharge(source){
  if(!charging||chargeSource!==source)return;
  throwPower=Math.min(1,.18+(performance.now()-chargeStarted)/1150);
  throwPending={power:throwPower,bottle};
  charging=false;chargeSource=null;
}
mouse=bindMouseControls({canvas,doc:document,active:controlsActive,aim:(x,y)=>world.look(x,y),
  charge:()=>startCharge('mouse'),release:()=>releaseCharge('mouse'),
  tap:()=>{if(!charging){startCharge('mouse');releaseCharge('mouse');}},
  cancel:()=>{if(chargeSource==='mouse'){charging=false;chargeSource=null;}}});
function setError(message){$('error').textContent=message;}
function selectBottle(kind){
  if(bottle!==kind){
    charging=false;
    chargeSource=null;
    throwPower=.6;
  }
  bottle=kind;
  world.setBottle(kind);
  $('bottle-title').textContent=kind==='heavy'?'BOTELLA PESADA':'BOTELLA DE CRISTAL';
  $('bottle-description').textContent=kind==='heavy'?'Corto alcance · empuja al estallar':'Mayor alcance · daño directo';
  for(const option of ['standard','heavy']){
    $('bottle-'+option).setAttribute('aria-pressed',String(option===kind));
  }
}
function exit(message=''){
  requestId++;
  const old=socket;socket=null;
  if(old)old.close(1000,'Volver al inicio');
  playerId=null;snapshot=null;connecting=false;
  throwPower=.6;clearControls();selectBottle('standard');document.exitPointerLock?.();updateMouseMode();
  clearTimeout(hitTimer);
  lastDamage=-100;
  $('hit-marker').hidden=true;
  $('death').hidden=true;
  $('zone-hud').hidden=true;
  $('player-list').hidden=true;
  $('feed').replaceChildren();
  $('lobby').hidden=false;$('hud').hidden=true;$('results').hidden=true;
  $('join').disabled=false;$('join').firstChild.textContent='A REBOTAR ';
  document.body.classList.remove('playing');
  world.leave();setError(message);
}

$('game-mode').addEventListener('change',()=>{
  $('mode-description').textContent=$('game-mode').value==='observation'
    ? 'Sube de la pista a la cima. La altura da más puntos.' : 'Gana el equipo con más eliminaciones.';
});
$('join-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(connecting||socket)return;
  const name=$('nickname').value.trim();
  const mode=$('game-mode').value;
  if(!name){setError('Escribe un apodo para entrar.');return;}
  world.enableAudio();
  connecting=true;$('join').disabled=true;$('join').firstChild.textContent='ENTRANDO… ';
  setError('');const attempt=++requestId;
  try{
    const response=await fetch('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mode}),signal:AbortSignal.timeout(8000)});
    const data=await response.json();
    if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Usa un apodo de hasta 16 letras, números, espacios o guiones.');
    if(attempt!==requestId)return;
    const url=new URL(data.websocketPath,location.href);
    url.protocol=location.protocol==='https:'?'wss:':'ws:';
    url.searchParams.set('token',data.token);
    const ws=new WebSocket(url);socket=ws;
    const timeout=setTimeout(()=>{if(socket===ws&&!playerId)exit('La conexión tardó demasiado. Vuelve a intentarlo.');},8000);
    ws.onmessage=event=>{
      if(socket!==ws)return;
      let message;
      try{message=JSON.parse(event.data);}catch{return;}
      if(message.type==='welcome'){
        clearTimeout(timeout);playerId=message.playerId;inputSeq=0;connecting=false;lastSnapshotAt=performance.now();
        world.enter(playerId,message.team);
        $('lobby').hidden=true;$('hud').hidden=false;
        document.body.classList.add('playing');
        updateMouseMode();canvas.focus({preventScroll:true});
        $('team-name').textContent=`EQUIPO ${message.team?'CORAL':'MENTA'}`;
        $('team-name').style.color=message.team?'#ff846e':'#9aead0';
        $('health-fill').style.background=message.team?'#ff846e':'#9aead0';
        try{localStorage.setItem('pogo-name',name);}catch{}
      }else if(message.type==='snapshot'){
        snapshot=message;lastSnapshotAt=performance.now();
        const {hits,downs}=world.setSnapshot(message);
        updateHud(message);
        if(hits&&message.status==='playing'){
          clearTimeout(hitTimer);
          const signal=downs?'BAJA REGISTRADA':'IMPACTO';
          const count=downs||hits;
          $('hit-marker').textContent=count>1?`${signal} ×${count}`:signal;
          $('hit-marker').classList.toggle('confirmed-down',downs>0);
          $('hit-marker').hidden=false;
          hitTimer=setTimeout(()=>$('hit-marker').hidden=true,downs?1050:420);
        }
      }else if(message.type==='pong'){
        const latency=Math.max(0,Math.round(performance.now()-message.timestamp));
        if(snapshot)$('network').textContent=`${latency} ms · ${snapshot.humans} humano${snapshot.humans===1?'':'s'} · ${snapshot.bots} bots`;
      }else if(message.type==='error'){
        console.warn(message.message);
      }
    };
    ws.onclose=()=>{
      clearTimeout(timeout);
      if(socket===ws)exit('Se perdió la conexión con el servidor. Puedes volver a entrar.');
    };
    ws.onerror=()=>{if(socket===ws)setError('No se pudo conectar. Comprueba que el servidor esté ejecutándose.');};
  }catch(error){
    if(attempt===requestId)exit(error.name==='TimeoutError'?'El servidor no respondió. Comprueba que esté encendido.':error.message);
  }
});

function roster(players,container){
  container.replaceChildren();
  const header=document.createElement('div');header.className='roster-row';
  for(const text of ['ESQUELETO','EQUIPO','ELIM.','CAÍDAS']){const span=document.createElement('span');span.textContent=text;header.append(span);}
  container.append(header);
  for(const p of [...players].sort((a,b)=>a.team-b.team||b.kills-a.kills)){
    const row=document.createElement('div');row.className=`roster-row ${p.team?'coral':'mint'}`;
    for(const text of [`${p.name}${p.id===playerId?' (TÚ)':''}${p.bot?' · BOT':''}`,p.team?'Coral':'Menta',p.kills,p.deaths]){
      const span=document.createElement('span');span.textContent=text;row.append(span);
    }
    container.append(row);
  }
}
function updateHud(s){
  if(!playerId)return;
  $('score-0').textContent=s.score[0];$('score-1').textContent=s.score[1];
  $('score-mode').textContent=s.mode==='observation'?'PUNTOS DE ZONA':'ELIMINACIONES';
  const zone=s.status==='playing'?s.zone:null;
  $('zone-hud').hidden=!zone;
  if(zone){
    $('zone-hud').dataset.state=zone.state;
    $('zone-label').textContent=zone.label;
    $('zone-timer').textContent=`${Math.ceil(zone.remaining)} s`;
    const states={empty:'Zona libre',contested:'En disputa',controlled:zone.owner===0?'Control de Menta':'Control de Coral'};
    $('zone-status').textContent=`${states[zone.state]} · ${zone.points??1} pt/s`;
    $('zone-next').hidden=!zone.nextLabel;
    if(zone.nextLabel)$('zone-next').textContent=`Sigue: ${zone.nextLabel}`;
  }
  const seconds=Math.ceil(s.remaining);
  $('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const me=s.players.find(p=>p.id===playerId);
  if(me){
    if(me.health<=0||!me.grounded)clearJump();
    if(me.hitAt>lastDamage&&s.status==='playing'&&s.time-me.hitAt<.25&&!reducedMotion.matches){
      const flash=$('damage-flash');
      for(const animation of flash.getAnimations())animation.cancel();
      flash.animate([{opacity:me.health<=0?.78:.42},{opacity:0}],{duration:me.health<=0?650:260,easing:'ease-out'});
    }
    lastDamage=me.hitAt??-100;
    $('hp').textContent=me.health;$('health-fill').style.width=`${me.health}%`;
    $('stats').textContent=`${me.kills} eliminaciones · ${me.deaths} caídas`;
    $('death').hidden=me.health>0||s.status==='finished';
    if(!$('death').hidden){
      const attacker=s.players.find(p=>p.id===me.hitBy);
      $('death-cause').textContent=attacker?`Botellazo de ${attacker.name}`:'Sujeto fuera de observación';
    }
    $('respawn').textContent=`Reapareces en ${Math.ceil(me.respawnIn)} s`;
    $('crosshair').hidden=me.health<=0||s.status==='finished';
  }
  if(!$('player-list').hidden)roster(s.players,$('player-list'));
  for(const e of s.events){
    const line=document.createElement('div');
    line.textContent=`${e.attacker}  ▸  ${e.victim}`;line.style.color=e.team?'#ffb09f':'#9aead0';
    $('feed').prepend(line);setTimeout(()=>line.remove(),3500);
    while($('feed').children.length>4)$('feed').lastChild.remove();
  }
  if(s.status==='finished'&&$('results').hidden){
    document.exitPointerLock?.();clearControls();
    $('results').hidden=false;
    $('result-title').textContent=s.winner===null?'HASTA MUERTOS, EMPATADOS.':`GANA ${s.winner?'CORAL':'MENTA'}.`;
    const metric=s.mode==='observation'?'Puntos de zona':'Eliminaciones';
    $('result-score').textContent=`MENTA ${s.score[0]} — ${s.score[1]} CORAL · ${metric}`;
    roster(s.players,$('result-players'));
  }
}

$('leave').addEventListener('click',()=>exit());
$('again').addEventListener('click',()=>exit());
$('mute-audience').addEventListener('click',()=>{
  muted=!muted;world.muteAudience(muted);$('mute-audience').textContent=muted?'Sonido: no':'Sonido: sí';$('mute-audience').setAttribute('aria-pressed',String(muted));
});
for(const kind of ['standard','heavy']){
  $('bottle-'+kind).addEventListener('click',()=>{
    selectBottle(kind);
    canvas.focus({preventScroll:true});
  });
}
function updateMouseMode(error=false){
  const locked=document.pointerLockElement===canvas;
  $('mouse-mode').textContent=locked?'Liberar ratón':'Capturar ratón';
  $('mouse-mode').setAttribute('aria-pressed',String(locked));
  $('throw-help').textContent=locked?'Ratón: apunta · Clic izquierdo o F: carga y suelta · Esc: libera':
    'Mueve el ratón sobre la arena o usa las flechas. Clic izquierdo o F: carga y suelta.';
  $('mouse-note').hidden=!error;
  if(error)$('mouse-note').textContent='No se pudo capturar el ratón. Puedes seguir jugando con el cursor libre.';
}
$('mouse-mode').addEventListener('click',()=>{
  if(!controlsActive())return;
  canvas.focus({preventScroll:true});
  if(document.pointerLockElement===canvas){document.exitPointerLock?.();return;}
  if(!canvas.requestPointerLock){updateMouseMode(true);return;}
  try{canvas.requestPointerLock()?.catch(()=>updateMouseMode(true));}catch{updateMouseMode(true);}
});
document.addEventListener('pointerlockchange',()=>{clearControls();updateMouseMode();});
document.addEventListener('pointerlockerror',()=>{if(controlsActive())updateMouseMode(true);});
document.addEventListener('keydown',event=>{
  if(!controlsActive()||event.target?.closest?.('input, textarea, select, button, [contenteditable]'))return;
  if(event.code==='Tab'){event.preventDefault();$('player-list').hidden=false;if(snapshot)roster(snapshot.players,$('player-list'));}
  if(movementKeys.has(event.code)){
    event.preventDefault();keys.add(event.code);
    if(!event.repeat&&arrowSteps[event.code])world.look(...arrowSteps[event.code]);
  }
  if(event.code==='Space'){
    event.preventDefault();
    const me=snapshot?.players.find(p=>p.id===playerId);
    if(!event.repeat&&me?.grounded&&me.health>0)jumpStarted=performance.now();
  }
  if(event.code==='KeyF'||event.key?.toLowerCase()==='f'){event.preventDefault();if(!event.repeat)startCharge('keyboard');}
  if(!event.repeat&&event.code==='Digit1')selectBottle('standard');
  if(!event.repeat&&event.code==='Digit2')selectBottle('heavy');
});
document.addEventListener('keyup',event=>{
  keys.delete(event.code);
  if(event.code==='Tab')$('player-list').hidden=true;
  if(event.code==='KeyF'||event.key?.toLowerCase()==='f')releaseCharge('keyboard');
  if(event.code==='Space'&&jumpStarted!==null){jumpPending=jumpCharge();jumpStarted=null;}
});
window.addEventListener('blur',clearControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});
setInterval(()=>{
  if(socket?.readyState!==WebSocket.OPEN||!playerId||snapshot?.status==='finished')return;
  const turnX=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
  const turnY=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
  if(turnX||turnY)world.look(turnX*28,turnY*22);
  const {yaw,pitch}=world.aim;
  const power=charging?Math.min(1,.18+(performance.now()-chargeStarted)/1150):throwPower;
  world.setCharge(power,charging);
  $('power-fill').style.width=`${Math.round(power*100)}%`;
  const me=snapshot?.players.find(p=>p.id===playerId),cooldown=me?.throwCooldown||0;
  const zone=snapshot?.zone;
  if(me&&zone){
    const direction=Math.atan2(zone.x-me.x,zone.z-me.z)-yaw;
    $('zone-direction').style.transform=`rotate(${direction}rad)`;
  }
  $('throw-status').textContent=cooldown>.1?'PREPARANDO OTRA BOTELLA':charging?'SUELTA PARA LANZAR':'MANTÉN CLIC O F PARA CARGAR';
  const jump=jumpStarted===null?null:jumpCharge();
  const jumpPercent=Math.round((jump??0)*100);
  world.setJumpCharge(jump);
  $('jump-tip').classList.toggle('jump-held',jump!==null);
  $('jump-fill').style.width=`${jumpPercent}%`;
  const jumpLabel=jump!==null?(jumpPercent===100?'Suelta · carga máxima':`Suelta para saltar · ${jumpPercent}%`)
    :me?.grounded===false?'En el aire':'Mantén y suelta para saltar';
  if($('jump-status').textContent!==jumpLabel)$('jump-status').textContent=jumpLabel;
  const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  let moveX=Math.sin(yaw)*forward+Math.cos(yaw)*right;
  let moveZ=Math.cos(yaw)*forward-Math.sin(yaw)*right;
  const length=Math.max(1,Math.hypot(moveX,moveZ));moveX/=length;moveZ/=length;
  socket.send(JSON.stringify({type:'input',seq:inputSeq++,moveX,moveZ,yaw,pitch,fire:Boolean(throwPending),
    power:throwPending?.power??power,bottle:throwPending?.bottle??bottle,jumpPower:jumpPending}));
  throwPending=null;jumpPending=null;
},50);
setInterval(()=>{
  if(socket?.readyState!==WebSocket.OPEN||!playerId)return;
  if(performance.now()-lastSnapshotAt>5000){exit('El servidor dejó de enviar la partida. Vuelve a entrar.');return;}
  socket.send(JSON.stringify({type:'ping',timestamp:performance.now()}));
},1000);
