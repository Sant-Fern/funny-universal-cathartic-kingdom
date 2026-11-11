import assert from 'node:assert/strict';
import test from 'node:test';
import {bindMouseControls} from '../src/mouse-controls.js';

function fixture(capture=false){
  const canvas=new EventTarget(),doc=new EventTarget(),events=[];
  canvas.focus=()=>{};canvas.clientWidth=800;doc.pointerLockElement=null;
  const controls=bindMouseControls({canvas,doc,active:()=>true,aim:(x,y)=>events.push(['aim',x,y]),
    charge:()=>events.push('charge'),release:()=>events.push('release'),tap:()=>events.push('tap'),
    cancel:()=>events.push('cancel'),capture:capture?()=>events.push('capture'):undefined,now:()=>1000});
  const send=(target,type,data)=>target.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),data));
  return{canvas,doc,events,controls,send};
}

test('mouse aims with no button held and keeps aiming while charging',()=>{
  const {canvas,doc,events,send}=fixture();
  send(canvas,'mouseenter',{clientX:100,clientY:80});
  send(canvas,'mousemove',{buttons:0,clientX:137,clientY:68,offsetX:137,movementX:0});
  send(canvas,'mousedown',{button:0});
  send(canvas,'mousemove',{buttons:1,clientX:150,clientY:68,offsetX:150});
  send(doc,'mouseup',{button:0});
  send(canvas,'click',{button:0});
  send(canvas,'mousemove',{buttons:0,clientX:165,clientY:60,offsetX:165});
  assert.deepEqual(events,[['aim',37,-12],'charge',['aim',13,0],'release',['aim',15,-8]]);
});

test('turning at the edge stops on leaving and re-entry does not jump',()=>{
  const {canvas,events,controls,send}=fixture();
  send(canvas,'mouseenter',{clientX:770,clientY:80});
  send(canvas,'mousemove',{buttons:0,clientX:795,clientY:80,offsetX:795});
  controls.advance(.05);
  send(canvas,'mouseleave',{});
  controls.advance(.05);
  send(canvas,'mouseenter',{clientX:280,clientY:180});
  send(canvas,'mousemove',{buttons:0,clientX:281,clientY:182,offsetX:281});
  controls.advance(.05);
  assert.deepEqual(events,[['aim',25,0],['aim',26,0],['aim',1,2]]);
});

test('capture uses relative movement once even while the mouse is over the arena',()=>{
  const {canvas,doc,events,send}=fixture();
  doc.pointerLockElement=canvas;
  send(canvas,'mouseenter',{clientX:100,clientY:80});
  send(canvas,'mousemove',{buttons:0,clientX:130,clientY:65,offsetX:130});
  send(doc,'mousemove',{buttons:0,movementX:11,movementY:-5});
  assert.deepEqual(events,[['aim',11,-5]]);
});

test('click-only input is usable without capture',()=>{
  const {canvas,events,send}=fixture();
  send(canvas,'click',{button:0});
  assert.deepEqual(events,['tap']);
});

test('the first press requests capture without consuming the throw',()=>{
  const {canvas,doc,events,send}=fixture(true);
  send(canvas,'mousedown',{button:0});
  doc.pointerLockElement=canvas;
  send(doc,'pointerlockchange',{});
  send(doc,'mouseup',{button:0});
  assert.deepEqual(events,['capture','charge','release']);
});

test('a release lost outside the window cancels the charge instead of throwing later',()=>{
  const {canvas,doc,events,send}=fixture();
  send(canvas,'mousedown',{button:0});
  send(doc,'mousemove',{buttons:0});
  send(doc,'mouseup',{button:0});
  assert.deepEqual(events,['charge','cancel']);
});
