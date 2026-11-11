import './style.css';
import { createWorld } from './world.js';
import { bindMouseControls } from './mouse-controls.js';
import { config } from '../../shared/physics.js';
import { nextTowerPad, summit as finish } from '../../shared/tower.js';

const $=id=>document.getElementById(id);
const canvas=$('arena');
const graphics=$('graphics-quality');
const graphicsDescription=$('graphics-description');
const modeSelect=$('game-mode');
const balloonTotal=config.balloons.targets.length;
const formatHeight=height=>`${height.toFixed(1).replace('.',',')} m`;
try{
  if(localStorage.getItem('pogo-graphics')==='low')graphics.value='low';
}catch{}
let world;
let mouse;
try {
  world=await createWorld(canvas, dt=>mouse?.advance(dt),graphics.value);
  $('loading').hidden=true;
} catch(error) {
  $('loading').textContent='No se pudo preparar la escena 3D. Recarga el juego y revisa la consola.';
  console.error(error);
  throw error;
}
function describeGraphics(){
  graphicsDescription.textContent=graphics.value==='low'
    ? 'Menor resolución, efectos y público.' : 'Sombras y efectos de luz.';
}
describeGraphics();
graphics.addEventListener('change',()=>{
  world.setQuality(graphics.value);
  describeGraphics();
  try{localStorage.setItem('pogo-graphics',graphics.value);}catch{}
});
const fpsLabels=[$('lobby-fps'),$('match-fps')];
for(const label of fpsLabels)label.title=world.renderer;
setInterval(()=>{
  if(document.hidden)return;
  const fps=world.getFPS();
  if(!Number.isFinite(fps)||fps<=0)return;
  const value=`${Math.round(fps)} FPS`;
  for(const label of fpsLabels)if(label.textContent!==value)label.textContent=value;
},1000);

let socket=null,playerId=null,snapshot=null,inputSeq=0,lastSnapshotAt=0;
let connecting=false,requestId=0,muted=false;
const keys=new Set();
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
const arrowSteps={ArrowLeft:[-28,0],ArrowRight:[28,0],ArrowUp:[0,-22],ArrowDown:[0,22]};
let charging=false,chargeStarted=0,chargeSource=null,throwPending=null,throwPower=.6;
let bottle='standard',hitTimer;
let lastDamage=-100;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let jumpStarted=null,jumpPending=null,spectating=false,stunned=false,restarting=false,restartMatch=null,deathNotice=0;
try{$('nickname').value=localStorage.getItem('pogo-name')||'Huesitos';}catch{}

function controlsActive(){return Boolean(playerId)&&snapshot?.status!=='finished';}
function clearJump(){jumpStarted=null;jumpPending=null;world.setJumpCharge(null);}
function clearControls(){keys.clear();mouse.reset();charging=false;chargeSource=null;throwPending=null;clearJump();world.setCharge(throwPower,false);world.setLean(0,0);world.fly(0,0,0,false);}
function movementInput(yaw){
  const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  const scale=Math.max(1,Math.hypot(forward,right));
  return {forward,right,moveX:(Math.sin(yaw)*forward+Math.cos(yaw)*right)/scale,
    moveZ:(Math.cos(yaw)*forward-Math.sin(yaw)*right)/scale};
}
const jumpCharge=()=>{
  const duration=snapshot?.mode==='race'?config.race.landingRecovery:config.jumpChargeSeconds;
  return Math.min(1,(performance.now()-jumpStarted)/(duration*1000));
};
function startCharge(source){
  if(charging||!controlsActive()||spectating||stunned)return;
  charging=true;chargeSource=source;chargeStarted=performance.now();
}
function releaseCharge(source){
  if(!charging||chargeSource!==source)return;
  throwPower=Math.min(1,.18+(performance.now()-chargeStarted)/1150);
  throwPending={power:throwPower,bottle};
  charging=false;chargeSource=null;
}
mouse=bindMouseControls({canvas,doc:document,active:controlsActive,aim:(x,y)=>world.look(x,y),
  capture:requestMouseCapture,
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
  const race=modeSelect.value==='race';
  $('bottle-description').textContent=kind==='heavy'
    ? (race?'Corto alcance · empuje en área':'Corto alcance · botella más grande')
    : (race?'Empuje directo · corrección cercana':'Apunta cerca de los globos · corrección suave');
  for(const option of ['standard','heavy']){
    $('bottle-'+option).setAttribute('aria-pressed',String(option===kind));
  }
}
function exit(message=''){
  requestId++;
  const old=socket;socket=null;
  if(old)old.close(1000,'Volver al inicio');
  playerId=null;snapshot=null;connecting=false;restarting=false;restartMatch=null;
  throwPower=.6;clearControls();selectBottle('standard');document.exitPointerLock?.();updateMouseMode();
  clearTimeout(hitTimer);
  lastDamage=-100;
  resetRoundHud();
  $('hit-marker').hidden=true;
  $('death').hidden=true;
  $('zone-hud').hidden=true;
  $('player-list').hidden=true;
  $('feed').replaceChildren();
  $('lobby').hidden=false;$('hud').hidden=true;$('results').hidden=true;
  modeSelect.disabled=false;$('join').disabled=false;$('join').firstChild.textContent='A REBOTAR ';
  document.body.classList.remove('playing');
  world.leave();setError(message);
}

function resetRoundHud(){
  spectating=false;stunned=false;
  clearTimeout(deathNotice);
  $('spectator-controls').hidden=true;$('player-controls').hidden=false;
  $('stun-status').hidden=true;$('death').hidden=true;
  $('hud').classList.remove('spectating');
  $('match-notice').hidden=true;$('result-notice').hidden=true;
}

function updateMode(){
  world.setMode(modeSelect.value);
  $('mode-description').textContent=modeSelect.value==='race'
    ? '5 contra 5. El primer equipo en la cima gana.' : 'Todos contra todos. Conserva tus tres globos.';
  selectBottle(bottle);
}
modeSelect.addEventListener('change',updateMode);
updateMode();
$('join-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(connecting||socket)return;
  const name=$('nickname').value.trim();
  const mode=modeSelect.value;
  if(!name){setError('Escribe un apodo para entrar.');return;}
  requestMouseCapture();
  world.enableAudio();
  modeSelect.disabled=true;
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
        world.setMode(message.mode);
        world.enter(playerId,message.yaw);
        $('lobby').hidden=true;$('hud').hidden=false;
        document.body.classList.add('playing');
        updateMouseMode();canvas.focus({preventScroll:true});
        const race=message.mode==='race', tint=race?(message.team?'#ff846e':'#9aead0'):'#f3d58e';
        $('team-name').textContent=race?`EQUIPO ${message.team?'CORAL':'MENTA'}`:'TODOS CONTRA TODOS';
        $('team-name').style.color=tint;
        $('health-fill').style.background=tint;
        try{localStorage.setItem('pogo-name',name);}catch{}
      }else if(message.type==='snapshot'){
        if(restartMatch&&message.matchId!==restartMatch)return;
        restartMatch=null;
        snapshot=message;lastSnapshotAt=performance.now();
        const {hits,downs,pops}=world.setSnapshot(message);
        updateHud(message);
        if(hits&&message.status==='playing'){
          clearTimeout(hitTimer);
          const signal=downs?'RIVAL DESCALIFICADO':pops?'GLOBO REVENTADO':'EMPUJÓN';
          const count=downs||pops||hits;
          $('hit-marker').textContent=count>1?`${signal} ×${count}`:signal;
          $('hit-marker').classList.toggle('confirmed-down',downs>0);
          $('hit-marker').hidden=false;
          hitTimer=setTimeout(()=>$('hit-marker').hidden=true,downs?1050:420);
        }
      }else if(message.type==='restarted'){
        restartMatch=message.matchId;restarting=false;snapshot=null;inputSeq=0;lastDamage=-100;
        clearControls();resetRoundHud();
        $('results').hidden=true;$('hit-marker').hidden=true;$('feed').replaceChildren();
        world.enter(playerId,message.yaw);canvas.focus({preventScroll:true});
      }else if(message.type==='restartDenied'){
        restarting=false;
        const notice=$($('results').hidden?'match-notice':'result-notice');
        notice.textContent=message.message;notice.hidden=false;
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

function roster(s,container){
  const race=s.mode==='race';
  container.replaceChildren();
  const header=document.createElement('div');
  header.className='roster-row';
  const headings=race?['ESQUELETO','EQUIPO','ALTURA','']:['ESQUELETO','GLOBOS','ACIERTOS','ESTADO'];
  for(const text of headings){
    const span=document.createElement('span');span.textContent=text;header.append(span);
  }
  container.append(header);
  const ordered=[...s.players].sort((a,b)=>race
    ? a.team-b.team||b.bestHeight-a.bestHeight
    : b.balloonCount-a.balloonCount||b.pops-a.pops);
  for(const p of ordered){
    const row=document.createElement('div');
    row.className='roster-row';
    if(race)row.classList.add(p.team?'coral':'mint');
    const name=p.name+(p.id===playerId?' (TÚ)':'')+(p.bot?' · BOT':'');
    const values=race?[name,p.team?'Coral':'Menta',formatHeight(p.bestHeight),'']
      :[name,p.balloonCount,p.pops,p.balloonCount?'EN PIE':'FUERA'];
    for(const text of values){
      const span=document.createElement('span');span.textContent=text;row.append(span);
    }
    container.append(row);
  }
}
function updateHud(s){
  if(!playerId)return;
  const race=s.mode==='race';
  $('mint-score').hidden=!race;$('coral-score').hidden=!race;
  if(race){
    $('score-0').textContent=formatHeight(s.score[0]);
    $('score-1').textContent=formatHeight(s.score[1]);
    $('score-mode').textContent='ALTURA DE EQUIPOS';
  }else{
    const remaining=s.players.filter(p=>p.balloonCount>0).length;
    $('score-mode').textContent='GLOBOS · '+remaining+' EN JUEGO';
  }
  $('zone-hud').hidden=!race||s.status!=='playing';
  $('zone-timer').textContent=formatHeight(finish.h);
  const seconds=Math.ceil(s.remaining);
  $('timer').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  const me=s.players.find(p=>p.id===playerId);
  if(me){
    stunned=me.stunnedUntil>s.time;
    $('stun-status').hidden=!stunned||me.health<=0||s.status!=='playing';
    if(stunned){clearJump();charging=false;chargeSource=null;throwPending=null;}
    if(race){
      const next=nextTowerPad(me);
      $('zone-label').textContent=next===finish?'Meta en la cima':`${next.level} / ${config.race.sections[next.level-1].name}`;
      $('zone-status').textContent=next===finish?'Aterriza dentro del anillo dorado.':`Siguiente salto · ${formatHeight(next.h)}`;
    }
    if(me.health<=0||!me.grounded)clearJump();
    if(me.hitAt>lastDamage&&s.status==='playing'&&s.time-me.hitAt<.25&&!reducedMotion.matches){
      const flash=$('damage-flash');
      for(const animation of flash.getAnimations())animation.cancel();
      flash.animate([{opacity:me.health<=0?.78:race?.24:.42},{opacity:0}],{duration:me.health<=0?650:260,easing:'ease-out'});
    }
    lastDamage=me.hitAt??-100;
    $('hp').textContent=race?formatHeight(Math.max(0,me.y)):me.balloonCount;
    $('hp-label').textContent=race?'ALTURA':'GLOBOS';
    const fraction=race?me.bestHeight/finish.h:me.balloonCount/balloonTotal;
    $('health-fill').style.width=(100*fraction)+'%';
    $('stats').textContent=race?'Mejor altura '+formatHeight(me.bestHeight):me.pops+' globos reventados';
    if(me.health<=0&&!spectating&&s.status==='playing'){
      spectating=true;clearControls();world.spectate();
      $('hud').classList.add('spectating');
      $('spectator-controls').hidden=false;$('player-controls').hidden=true;
      const attacker=s.players.find(p=>p.id===me.hitBy);
      $('death-cause').textContent=attacker?attacker.name+' reventó tu último globo.':'Te quedaste sin globos.';
      $('respawn').textContent='Cámara libre · WASD para moverte';
      $('death').hidden=false;deathNotice=setTimeout(()=>$('death').hidden=true,2300);
      updateMouseMode();
    }
    $('crosshair').hidden=me.health<=0||s.status==='finished';
  }
  if(!$('player-list').hidden)roster(s,$('player-list'));
  for(const e of s.events){
    const line=document.createElement('div');
    line.textContent=e.attacker+'  ▸  '+e.victim;
    line.style.color='#f3d58e';
    $('feed').prepend(line);setTimeout(()=>line.remove(),3500);
    while($('feed').children.length>4)$('feed').lastChild.remove();
  }
  if(s.status==='finished'&&$('results').hidden){
    document.exitPointerLock?.();clearControls();
    $('results').hidden=false;
    if(race){
      $('result-title').textContent=s.winner===null?'CARRERA EMPATADA.':'GANA '+(s.winner?'CORAL':'MENTA')+'.';
      $('result-score').textContent='Mejor altura · Menta '+formatHeight(s.score[0])+' · Coral '+formatHeight(s.score[1]);
    }else{
      const winner=s.players.find(p=>p.id===s.winner);
      $('result-title').textContent=winner?'GANA '+winner.name.toLocaleUpperCase('es')+'.':'EMPATE DE GLOBOS.';
      const best=Math.max(0,...s.players.map(p=>p.balloonCount));
      $('result-score').textContent=best===1?'1 globo en el primer lugar':best+' globos en el primer lugar';
    }
    roster(s,$('result-players'));
  }
}

$('leave').addEventListener('click',()=>exit());
$('again').addEventListener('click',()=>exit());
for(const id of ['restart','restart-results'])$(id).addEventListener('click',()=>{
  if(restarting||socket?.readyState!==WebSocket.OPEN)return;
  if(snapshot?.humans===1)requestMouseCapture();
  restarting=true;
  socket.send(JSON.stringify({type:'restart'}));
});
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
  $('throw-help').textContent=spectating?'Ratón o flechas para mirar · Esc para liberar el cursor':
    locked?'Ratón para apuntar · Clic o F para lanzar · Esc para liberar el cursor':
    'Haz clic en la arena para fijar el ratón. También puedes apuntar con las flechas.';
  $('mouse-note').hidden=!error;
  if(error)$('mouse-note').textContent='No se pudo capturar el ratón. Puedes seguir jugando con el cursor libre.';
}
function requestMouseCapture(){
  if(document.pointerLockElement===canvas)return;
  if(!canvas.requestPointerLock){updateMouseMode(true);return;}
  try{canvas.requestPointerLock()?.catch(()=>updateMouseMode(true));}catch{updateMouseMode(true);}
}
$('mouse-mode').addEventListener('click',()=>{
  if(!controlsActive())return;
  canvas.focus({preventScroll:true});
  if(document.pointerLockElement===canvas)document.exitPointerLock?.();
  else requestMouseCapture();
});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement!==canvas)clearControls();
  else canvas.focus({preventScroll:true});
  updateMouseMode();
});
document.addEventListener('pointerlockerror',()=>{if(controlsActive())updateMouseMode(true);});
document.addEventListener('keydown',event=>{
  if(event.code==='Escape'&&document.pointerLockElement===canvas){
    document.exitPointerLock?.();
    return;
  }
  if(!controlsActive()||event.target?.closest?.('input, textarea, select, button, [contenteditable]'))return;
  if(event.code==='Tab'){event.preventDefault();$('player-list').hidden=false;if(snapshot)roster(snapshot,$('player-list'));}
  if(movementKeys.has(event.code)){
    event.preventDefault();keys.add(event.code);
    if(!event.repeat&&arrowSteps[event.code])world.look(...arrowSteps[event.code]);
  }
  if(spectating){
    if(['KeyE','KeyQ','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(event.code)){
      event.preventDefault();keys.add(event.code);
    }
    return;
  }
  if(event.code==='Space'){
    event.preventDefault();
    const me=snapshot?.players.find(p=>p.id===playerId);
    if(!event.repeat&&me?.grounded&&me.health>0&&!stunned)jumpStarted=performance.now();
  }
  if(event.code==='KeyF'||event.key?.toLowerCase()==='f'){event.preventDefault();if(!event.repeat)startCharge('keyboard');}
  if(!event.repeat&&event.code==='Digit1')selectBottle('standard');
  if(!event.repeat&&event.code==='Digit2')selectBottle('heavy');
});
document.addEventListener('keyup',event=>{
  keys.delete(event.code);
  if(event.code==='Tab')$('player-list').hidden=true;
  if(event.code==='KeyF'||event.key?.toLowerCase()==='f')releaseCharge('keyboard');
  if(event.code==='Space'&&jumpStarted!==null){
    const {moveX,moveZ}=movementInput(world.aim.yaw);
    jumpPending={power:jumpCharge(),moveX,moveZ};jumpStarted=null;
  }
});
window.addEventListener('blur',clearControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});
setInterval(()=>{
  if(socket?.readyState!==WebSocket.OPEN||!playerId||snapshot?.status==='finished')return;
  const turnX=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
  const turnY=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
  if(turnX||turnY)world.look(turnX*28,turnY*22);
  const {forward,right,moveX,moveZ}=movementInput(world.aim.yaw);
  if(spectating){
    const up=Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ')||keys.has('ControlLeft')||keys.has('ControlRight'));
    world.fly(forward,right,up,keys.has('ShiftLeft')||keys.has('ShiftRight'));
    return;
  }
  const {yaw,pitch}=world.aim;
  const power=charging?Math.min(1,.18+(performance.now()-chargeStarted)/1150):throwPower;
  world.setCharge(power,charging);
  $('power-fill').style.width=`${Math.round(power*100)}%`;
  const me=snapshot?.players.find(p=>p.id===playerId),cooldown=me?.throwCooldown||0;
  if(me&&snapshot.mode==='race'){
    const next=nextTowerPad(me);
    const direction=Math.atan2(next.x-me.x,next.z-me.z)-yaw;
    $('zone-direction').style.transform=`rotate(${direction}rad)`;
  }
  $('throw-status').textContent=stunned?'RECUPERANDO EL EQUILIBRIO':cooldown>.1?'PREPARANDO OTRA BOTELLA':charging?'SUELTA PARA LANZAR':'MANTÉN CLIC O F PARA CARGAR';
  const jump=jumpStarted===null?null:jumpCharge();
  const jumpPercent=Math.round((jump??0)*100);
  world.setJumpCharge(jump);
  $('jump-tip').classList.toggle('jump-held',jump!==null);
  $('jump-fill').style.width=`${jumpPercent}%`;
  const jumpLabel=jump!==null?(jumpPercent===100?'Suelta · carga máxima':`Suelta para saltar · ${jumpPercent}%`)
    :me?.grounded===false?'En el aire':'Mantén y suelta para saltar';
  if($('jump-status').textContent!==jumpLabel)$('jump-status').textContent=jumpLabel;
  world.setLean(stunned?0:moveX,stunned?0:moveZ);
  socket.send(JSON.stringify({type:'input',seq:inputSeq++,moveX:jumpPending?.moveX??moveX,moveZ:jumpPending?.moveZ??moveZ,
    yaw,pitch,fire:Boolean(throwPending),power:throwPending?.power??power,bottle:throwPending?.bottle??bottle,
    jumpPower:jumpPending?.power??null}));
  throwPending=null;jumpPending=null;
},50);
setInterval(()=>{
  if(socket?.readyState!==WebSocket.OPEN||!playerId)return;
  if(performance.now()-lastSnapshotAt>5000){exit('El servidor dejó de enviar la partida. Vuelve a entrar.');return;}
  socket.send(JSON.stringify({type:'ping',timestamp:performance.now()}));
},1000);
