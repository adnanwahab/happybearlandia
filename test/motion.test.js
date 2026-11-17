import {test,expect} from 'bun:test';
import {createMotionAdapter,motionTokens} from '../shared/media/motion.js';
function setup(document={},reducedMotion=false){let listener;const preferences={get:()=>({reducedMotion}),subscribe(fn){listener=fn;fn({reducedMotion});return()=>{listener=null;};}};return {adapter:createMotionAdapter({document,preferences}),reduce(){reducedMotion=true;listener({reducedMotion});}};}
test('tokens are immutable presentation values',()=>{expect(Object.isFrozen(motionTokens.duration)).toBe(true);expect(motionTokens.duration.transition).toBe(250);});
test('fallback awaits commit before focus and propagates failure',async()=>{const {adapter}=setup();const events=[];await adapter.transition(async()=>{events.push('commit');},{focus:{focus(){events.push('focus');}}});expect(events).toEqual(['commit','focus']);await expect(adapter.transition(()=>{throw Error('update');})).rejects.toThrow('update');});
test('reduced motion avoids native capture',async()=>{const {adapter}=setup({startViewTransition(){throw Error('must not capture');}},true);let count=0;await adapter.transition(()=>count++);expect(count).toBe(1);});
test('capture failure after callback cannot duplicate update',async()=>{let count=0;const {adapter}=setup({startViewTransition(commit){commit();throw Error('capture failed');}});await adapter.transition(()=>count++);expect(count).toBe(1);});
test('live reduction skips active animation; disposal rejects future transitions',async()=>{let release,skipped=0;const finished=new Promise(r=>release=r);const {adapter,reduce}=setup({startViewTransition(commit){return {ready:Promise.resolve(),updateCallbackDone:commit(),finished,skipTransition(){skipped++;release();}};}});let count=0;const pending=adapter.transition(()=>count++);reduce();await pending;expect(count).toBe(1);expect(skipped).toBe(1);adapter.dispose();await expect(adapter.transition(()=>count++)).rejects.toThrow('disposed');});

test('ten pending reversals cancel stale preparation and leave latest scene coherent',async()=>{
 const {adapter}=setup();let scene='stable',url='stable';const releases=[],pending=[];
 for(let i=0;i<10;i++)pending.push(adapter.transition(()=>{scene=url=String(i);},{prepare:()=>new Promise(resolve=>releases.push(resolve))}));
 releases.reverse().forEach(resolve=>resolve());
 expect(await Promise.all(pending)).toEqual([...Array(9).fill(false),true]);
 expect(scene).toBe('9');expect(url).toBe(scene);adapter.dispose();
});
test('superseding active capture skips it and suppresses stale focus',async()=>{
 let skips=0,focus=0;
 const {adapter}=setup({startViewTransition(commit){return {ready:Promise.resolve(),updateCallbackDone:commit(),finished:new Promise(()=>{}),skipTransition(){skips++;}};}});
 const first=adapter.transition(()=>{}, {focus:{focus(){focus++;}}});
 adapter.cancel();expect(await first).toBe(false);expect(skips).toBe(1);expect(focus).toBe(0);adapter.dispose();
});
test('failed preparation rolls back once and permits retry',async()=>{
 const {adapter}=setup();let state='stable',rollbacks=0;
 await expect(adapter.transition(()=>state='wrong',{prepare:()=>Promise.reject(Error('route missing')),rollback:()=>{state='stable';rollbacks++;}})).rejects.toThrow('route missing');
 expect(state).toBe('stable');expect(rollbacks).toBe(1);
 await adapter.transition(()=>state='retry');expect(state).toBe('retry');adapter.dispose();
});
test('watchdog releases hung preparation and aborts owned resources',async()=>{
 let aborted=false,rolled=false;
 const adapter=createMotionAdapter({document:{},preferences:{get:()=>({reducedMotion:false}),subscribe:()=>()=>{}},timeoutMs:10});
 await expect(adapter.transition(()=>{throw Error('stale');},{prepare:signal=>{signal.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});},rollback:()=>rolled=true})).rejects.toThrow('timed out');
 expect(aborted).toBe(true);expect(rolled).toBe(true);adapter.dispose();
});
