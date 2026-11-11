import { describe, test, expect } from 'bun:test';
import { createQuickDemoController } from '../world/onboarding/quick-demo-controller.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
const actual = { avg: { noPlan: 42, withPlan: 43 }, improved: 2, worse: 1 };

describe('quick demo orchestration', () => {
  test('waits for readiness, observes immediately and computes before observation finishes', async () => {
    const ready=deferred(), observation=deferred(), computation=deferred(), calls=[], states=[];
    const controller=createQuickDemoController({
      waitForReady:()=>ready.promise,
      observeResident:()=>{calls.push('observe');return observation.promise;},
      runComparison:()=>{calls.push('compute');return computation.promise;},
      revealComparison:(result,context)=>calls.push([result,context.observation]),
      onState:state=>states.push(state),
    });
    const done=controller.start({seed:8});
    await flush(); expect(calls).toEqual([]);
    ready.resolve(); await flush(); expect(calls).toEqual(['observe','compute']);
    expect(controller.getState().result).toBeNull();
    observation.resolve({residentId:0,mood:0.4}); computation.resolve(actual);
    await done;
    expect(calls[2]).toEqual([actual,{residentId:0,mood:0.4}]);
    expect(states.map(s=>s.status)).toContain('observing');
    expect(controller.getState().status).toBe('completed');
    expect(controller.getState().timings.workerStartupMs).toBeNull();
    expect(controller.getState().timings.computationMs).toBeNull();
  });
  test('reports only actual fractions and separately measured timings with reduced motion', async () => {
    let time=10, context;
    const controller=createQuickDemoController({now:()=>time,reducedMotion:()=>true,
      waitForReady:()=>{time=15;}, observeResident:()=>({id:'real'}),
      runComparison:ctx=>{context=ctx;time=20;ctx.markWorkerReady();time=30;ctx.onProgress({stage:'day 2',frac:0});return actual;},
      revealComparison:()=>{time=35;},
    });
    await controller.start();
    expect(context.reducedMotion).toBe(true);
    expect(controller.getState().progress).toEqual({stage:'day 2',fraction:0});
    expect(controller.getState().timings).toMatchObject({readinessMs:5,workerStartupMs:5,computationMs:10,revealMs:5,totalMs:25});
    context.onProgress({stage:'late',frac:1});
    expect(controller.getState().progress.stage).toBe('day 2');
  });
  test('stop settles an uncooperative worker and discards stale progress/result on replay', async () => {
    const runs=[], reveals=[];
    const controller=createQuickDemoController({runComparison:ctx=>{const d=deferred();runs.push({...d,ctx});return d.promise;},revealComparison:r=>reveals.push(r)});
    const first=controller.start({seed:9});await flush();controller.stop();
    expect((await first).status).toBe('stopped');expect(runs[0].ctx.signal.aborted).toBe(true);
    const second=controller.replay();await flush();
    runs[0].ctx.onProgress({stage:'stale',frac:1});runs[0].resolve({fake:'old'});await flush();
    expect(controller.getState().result).toBeNull();expect(controller.getState().progress).toBeNull();
    runs[1].resolve(actual);await second;expect(reveals).toEqual([actual]);
    expect(runs[1].ctx.runId).not.toBe(runs[0].ctx.runId);
  });
  test('replay retains captured inputs despite caller and hook mutations; result is detached/frozen', async () => {
    const inputs={seed:11,plan:['transit']},seen=[];let result=structuredClone(actual);
    const controller=createQuickDemoController({runComparison:ctx=>{seen.push(structuredClone(ctx.inputs));ctx.inputs.plan.push('mutated');return result;},
      revealComparison:r=>{expect(Object.isFrozen(r.avg)).toBe(true);}});
    const first=controller.start(inputs);inputs.plan.push('caller');await first;
    result.avg.withPlan=999;expect(controller.getState().result.avg.withPlan).toBe(43);
    await controller.replay();expect(seen).toEqual([{seed:11,plan:['transit']},{seed:11,plan:['transit']}]);
  });
  test('external abort, readiness errors, reveal cancellation, and recovery are bounded', async () => {
    const gate=deferred(),external=new AbortController();let fail=true;
    const controller=createQuickDemoController({waitForReady:()=>{if(fail)throw new Error('not ready');},runComparison:()=>actual,revealComparison:()=>gate.promise});
    expect((await controller.start()).error).toBe('not ready');fail=false;
    const run=controller.start({}, {signal:external.signal});await flush();expect(controller.getState().status).toBe('revealing');
    external.abort();expect((await run).status).toBe('stopped');gate.resolve();
    expect((await controller.replay()).status).toBe('completed');
    controller.dispose();expect(()=>controller.replay()).toThrow();
  });
  test('no-argument start supports replay with the frozen public contract', async () => {
    let calls=0;const controller=createQuickDemoController({runComparison:()=>{calls++;return actual;}});
    await controller.start();await controller.replay();expect(calls).toBe(2);
  });
  test('missing data stays null; worker errors can be replayed', async () => {
    let fail=true;const results=[];
    const controller=createQuickDemoController({runComparison:()=>{if(fail)throw new Error('worker failed');return null;},revealComparison:r=>results.push(r)});
    expect((await controller.start({seed:1})).error).toBe('worker failed');fail=false;
    await controller.replay();expect(results).toEqual([null]);expect(controller.getState().result).toBeNull();
  });
  test('rejects malformed progress rather than fabricating a fraction and accepts measured metadata', async () => {
    const controller=createQuickDemoController({runComparison:ctx=>{ctx.onProgress({stage:'warming',frac:NaN,workerStartupMs:4,computationMs:12});return actual;}});
    await controller.start();expect(controller.getState().progress.fraction).toBeNull();
    expect(controller.getState().timings).toMatchObject({workerStartupMs:4,computationMs:12});
  });
});
