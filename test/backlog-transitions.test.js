import { test, expect } from 'bun:test';
import { attachFutureTransitions } from '../world/decision/backlog-transitions/index.js';
function fixture({reduced=false,seed=0}={}) {
  let selection = {experimentId:'saved-1',runId:'plan-0',scenarioId:'plan',modelVersion:'housing.v1',seed,month:16,comparison:{baselineRunId:'base-0',month:16,mode:'split'}};
  const frames = new Map(), listeners = new Map(); let id=0, effects=0, cancelled=0;
  const motion = {matches:reduced,addEventListener(t,f){listeners.set('motion',f)},removeEventListener(){listeners.delete('motion')}};
  const env = {scrollY:0,scrollX:12,innerHeight:600,document:{scrollingElement:{scrollHeight:4000}},matchMedia:()=>motion,
    scrollTo({top,left}){this.scrollY=top;this.scrollX=left},requestAnimationFrame(f){frames.set(++id,f);return id},cancelAnimationFrame(i){frames.delete(i)},
    addEventListener(t,f){listeners.set(t,f)},removeEventListener(t){listeners.delete(t)}};
  const view = top => ({isConnected:true,getBoundingClientRect:()=>({top:top-env.scrollY,left:0,width:900,height:500}),animate(){effects++;return {cancel(){cancelled++}}}});
  const city=view(1800), multiverse=view(300);
  const adapter=attachFutureTransitions({city,multiverse,getSelection:()=>selection,environment:env,duration:100});
  return {adapter,env,city,motion,listeners,frames,get effects(){return effects},get cancelled(){return cancelled},get selection(){return selection},set selection(s){selection=s},step(t){const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(t))}};
}
test('bidirectional flights keep exact stored identity, month, seed and comparison without mutation',async()=>{
  const f=fixture({seed:4294967295}), before=structuredClone(f.selection);
  const p=f.adapter.flyTo('city');f.step(0);f.step(50);expect(f.env.scrollY).toBe(892);f.step(100);
  const result=await p;expect(result.status).toBe('completed');expect(result.selection).toEqual(before);expect(Object.isFrozen(result.selection.comparison)).toBe(true);expect(f.selection).toEqual(before);expect(f.env.scrollX).toBe(12);
  const back=f.adapter.flyTo('multiverse');f.step(200);f.step(300);expect((await back).selection).toEqual(before);expect(f.env.scrollY).toBe(284);expect(f.cancelled).toBe(2);f.adapter.detach();
});
test('superseded callbacks cannot move a later flight',async()=>{
  const f=fixture(), first=f.adapter.flyTo('city'), stale=[...f.frames.values()][0];
  const second=f.adapter.flyTo('multiverse');stale(1000);expect(f.env.scrollY).toBe(0);expect((await first).reason).toBe('superseded');f.step(0);f.step(100);expect((await second).status).toBe('completed');expect(f.env.scrollY).toBe(284);f.adapter.detach();
});
for (const field of ['runId','month','seed','comparison']) test(`changing ${field} cancels before another scroll`,async()=>{
  const f=fixture(), p=f.adapter.flyTo('city');f.step(0);
  f.selection={...f.selection,[field]:field==='runId'?'other':field==='comparison'?{...f.selection.comparison,mode:'difference'}:17};
  f.step(50);expect((await p).reason).toBe('selection-changed');expect(f.env.scrollY).toBe(0);expect(f.frames.size).toBe(0);f.adapter.detach();
});
for(const type of ['wheel','pointerdown','touchstart','resize','keydown']) test(`${type} preserves manual control`,async()=>{
  const f=fixture(),p=f.adapter.flyTo('city');f.step(0);f.listeners.get(type)({key:'Tab'});expect((await p).reason).toBe('manual-control');f.step(100);expect(f.env.scrollY).toBe(0);f.adapter.detach();
});
test('reduced motion skips all animation, including preference changes mid-flight',async()=>{
  const f=fixture({reduced:true});expect((await f.adapter.flyTo('city')).reason).toBe('reduced-motion');expect(f.effects).toBe(0);expect(f.frames.size).toBe(0);
  f.motion.matches=false;const p=f.adapter.flyTo('multiverse');f.step(0);f.motion.matches=true;f.listeners.get('motion')();expect((await p).status).toBe('completed');expect(f.env.scrollY).toBe(284);expect(f.frames.size).toBe(0);f.adapter.detach();
});
test('detach is idempotent, removes listeners/effects and invalidates stale frames',async()=>{
  const f=fixture(),p=f.adapter.flyTo('city'),stale=[...f.frames.values()][0];f.adapter.detach();f.adapter.detach();stale(1000);
  expect((await p).reason).toBe('detached');expect(f.listeners.size).toBe(0);expect(f.frames.size).toBe(0);expect(f.cancelled).toBe(1);expect(f.env.scrollY).toBe(0);expect(()=>f.adapter.flyTo('city')).toThrow('detached');
});
test('missing/invalid native selection refuses flight; detached target never animates',async()=>{
  const f=fixture();f.selection={...f.selection,seed:-1};expect(()=>f.adapter.flyTo('city')).toThrow();expect(f.effects).toBe(0);
  f.selection={...f.selection,seed:0};f.city.isConnected=false;expect((await f.adapter.flyTo('city')).reason).toBe('view-detached');f.adapter.detach();
});
test('DOM removal cancels active flight',async()=>{const f=fixture(),p=f.adapter.flyTo('city');f.city.isConnected=false;f.step(0);expect((await p).reason).toBe('view-detached');f.adapter.detach()});
