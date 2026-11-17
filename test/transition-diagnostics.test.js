import {test,expect} from 'bun:test';
import {createTransitionDiagnostics} from '../shared/media/transition-diagnostics.js';
import {createMotionAdapter} from '../shared/media/motion.js';
function clock(){let time=0,id=0;const frames=new Map(),timers=new Map();return {performance:{now:()=>time},requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(id){timers.delete(id);},step(ms){time+=ms;const current=[...frames.values()];frames.clear();for(const fn of current)fn(time);},timeout(){for(const fn of [...timers.values()])fn();},pending:()=>frames.size+timers.size};}
test('no work without consent; 20 repeat receipts are bounded and detached; revocation clears work',()=>{
 const win=clock(),d=createTransitionDiagnostics(win);d.begin('native')();expect(win.pending()).toBe(0);expect(d.get().samples).toEqual([]);
 d.setConsent(true);for(let i=0;i<25;i++){const end=d.begin('native');win.step(16);win.step(34);end();expect(win.pending()).toBe(0);}
 const result=d.get();expect(result.samples).toHaveLength(20);expect(result.samples[0]).toMatchObject({durationMs:50,frames:2,estimatedMissedFrames:1,maxFrameGapMs:34,rendererMemory:null});result.samples.pop();expect(d.get().samples).toHaveLength(20);
 d.begin('native');d.setConsent(false);expect(win.pending()).toBe(0);expect(d.get().samples).toEqual([]);expect(d.get().active).toBe(0);
});
test('frame gap and duration thresholds skip active capture and simplify subsequent adapter commands',async()=>{
 for(const cause of ['gap','duration']){const win=clock(),d=createTransitionDiagnostics(win);d.setConsent(true);let calls=0,skips=0,release;
 const adapter=createMotionAdapter({document:{startViewTransition(commit){calls++;return {ready:Promise.resolve(),updateCallbackDone:commit(),finished:new Promise(r=>release=r),skipTransition(){skips++;release();}};}},preferences:{get:()=>({reducedMotion:false}),subscribe:()=>()=>{}},diagnostics:d});
 let commits=0;const pending=adapter.transition(()=>commits++);if(cause==='gap')win.step(120);else win.timeout();await pending;await adapter.transition(()=>commits++);
 expect(commits).toBe(2);expect(calls).toBe(1);expect(skips).toBe(1);expect(d.get().simpleMotion).toBe(true);expect(win.pending()).toBe(0);adapter.dispose();expect(d.get().samples).toEqual([]);}
});
test('missing frame APIs are explicit; unsupported transitions and update failures finish cleanly',async()=>{
 const d=createTransitionDiagnostics({performance:{now:()=>1}});d.setConsent(true);
 const adapter=createMotionAdapter({document:{},preferences:{get:()=>({reducedMotion:false}),subscribe:()=>()=>{}},diagnostics:d});
 await adapter.transition(()=>{});await expect(adapter.transition(()=>{throw Error('failure');})).rejects.toThrow('failure');
 expect(d.get().samples.map(s=>[s.mode,s.outcome,s.frameSampling])).toEqual([['immediate','completed','unsupported'],['immediate','failed','unsupported']]);expect(d.get().active).toBe(0);adapter.dispose();
});
test('disposal during a sample cancels all measurement callbacks',()=>{const win=clock(),d=createTransitionDiagnostics(win);d.setConsent(true);const end=d.begin('native');d.dispose();end();expect(win.pending()).toBe(0);expect(d.get().active).toBe(0);expect(d.get().samples).toEqual([]);});
