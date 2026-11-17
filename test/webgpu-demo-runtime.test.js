import {test, expect} from 'bun:test';
import {manageWebGPUDemo} from '../tools/webgpu-demo-runtime.js';

// The real exported lifecycle and alert renderer run against synthetic browser
// boundaries. Bun also fails this suite for an unhandled promise rejection.
async function fixture(run) {
  const previous = {document:globalThis.document, window:globalThis.window};
  const notices=[], events={};
  globalThis.document={getElementById:id=>notices.find(n=>n.id===id),createElement:()=>({style:{},setAttribute(key,value){this[key]=value;}}),body:{append:n=>notices.push(n)}};
  globalThis.window={addEventListener:(name,fn)=>events[name]=fn};
  let resolve,reject;const lost=new Promise((a,b)=>{resolve=a;reject=b;});
  const calls=[];
  const resource=name=>({dispose(){calls.push(name);}});
  const geometry=resource('geometry'), texture={...resource('texture'),isTexture:true},material={...resource('material'),map:texture};
  const renderer={backend:{device:{lost}},setAnimationLoop:value=>{expect(value).toBeNull();calls.push('stop');},dispose(){calls.push('renderer');}};
  const scene={traverse:fn=>{fn({geometry,material});fn({geometry,material});}};
  const controls=resource('controls');
  try {await run({renderer,scene,controls,calls,notices,events,resolve,reject,geometry});}
  finally {globalThis.document=previous.document;globalThis.window=previous.window;}
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('device loss stops and disposes once, deduplicates resources and shows actionable alert',()=>fixture(async f=>{
 const dispose=manageWebGPUDemo(f.renderer,f.scene,f.controls);
 f.resolve({message:'Injected device loss'});await flush();dispose();
 expect(f.calls).toEqual(['stop','controls','geometry','material','texture','renderer']);
 expect(f.notices).toHaveLength(1);expect(f.notices[0].role).toBe('alert');
 expect(f.notices[0].textContent).toContain('Injected device loss');expect(f.notices[0].textContent).toContain('reload');
}));
test('cleanup failures still attempt all resources and show loss without rejecting',()=>fixture(async f=>{
 f.geometry.dispose=()=>{f.calls.push('geometry');throw Error('injected cleanup failure');};
 f.renderer.setAnimationLoop=()=>{f.calls.push('stop');throw Error('injected stop failure');};
 manageWebGPUDemo(f.renderer,f.scene,f.controls);f.resolve({message:'Lost during cleanup'});await flush();
 expect(f.calls).toEqual(['stop','controls','geometry','material','texture','renderer']);
 expect(f.notices).toHaveLength(1);expect(f.notices[0].textContent).toContain('Lost during cleanup');
}));
test('rejected device notification produces actionable error',()=>fixture(async f=>{
 manageWebGPUDemo(f.renderer,f.scene,f.controls);f.reject(Error('injected connection failure'));await flush();
 expect(f.notices[0].textContent).toContain('injected connection failure');expect(f.notices[0].textContent).toContain('Reload');
}));
test('bfcache pagehide retains resources; final pagehide disposes and late loss stays quiet',()=>fixture(async f=>{
 manageWebGPUDemo(f.renderer,f.scene,f.controls);f.events.pagehide({persisted:true});expect(f.calls).toEqual([]);
 f.events.pagehide({persisted:false});f.resolve({message:'late'});await flush();
 expect(f.calls.filter(c=>c==='renderer')).toHaveLength(1);expect(f.notices).toHaveLength(0);
}));
