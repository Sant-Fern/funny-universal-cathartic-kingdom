import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForLoad} from '../src/game-loader.js';

test('cancelling a pending scene returns immediately and disposes a late result',async()=>{
  const controller=new AbortController();
  let complete;
  const pending=new Promise(resolve=>{complete=resolve;});
  const disposed=[];
  const loading=waitForLoad(pending,controller.signal,world=>disposed.push(world));
  controller.abort();
  await assert.rejects(loading,{name:'AbortError'});
  const lateWorld={name:'cancelled scene'};
  complete(lateWorld);
  await Promise.resolve();
  assert.deepEqual(disposed,[lateWorld]);
});

test('asset errors and loading timeouts reach the caller instead of hanging',async()=>{
  const failure=new Error('Missing skeleton');
  await assert.rejects(waitForLoad(Promise.reject(failure)),failure);
  const signal=AbortSignal.timeout(5);
  const timeout=assert.rejects(waitForLoad(new Promise(()=>{}),signal),{name:'TimeoutError'});
  // Node timeout signals are unreferenced. Keep this test alive until they fire.
  const keepAlive=setTimeout(()=>{},100);
  try{await timeout;}finally{clearTimeout(keepAlive);}
});

test('cancellation after a completed load leaves the accepted world alive',async()=>{
  const controller=new AbortController();
  let disposed=false;
  const world={name:'ready scene'};
  assert.equal(await waitForLoad(Promise.resolve(world),controller.signal,()=>{disposed=true;}),world);
  controller.abort();
  assert.equal(disposed,false);
});
