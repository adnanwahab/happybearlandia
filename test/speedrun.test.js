import {test,expect} from 'bun:test';
import {speedrunScenario,runSpeedrun,assertMatchingReplay,decisionTimer} from '../world/challenges/speedrun.js';
test('pinned demo: success and failure replay deterministically without mutating checkpoint',async()=>{
 const envelope=await speedrunScenario(),before=JSON.stringify(envelope);
 const win=await runSpeedrun(envelope,['housing']);
 expect(win).toEqual(await runSpeedrun(envelope,['housing']));
 expect(win).toMatchObject({score:33,success:true,placement:1,replayVerified:true});
 expect(win.result.metrics[0]).toMatchObject({reference:6,candidate:4});
 expect(win.result.budget.candidateSpent).toBe(1000);
 const altered=structuredClone(win.result);altered.candidate.state.finance.balance+=1;
 expect(()=>assertMatchingReplay(win.result,altered)).toThrow('Replay mismatch');
 expect(win.result.reference.initialHash).toBe(win.result.candidate.initialHash);
 expect(win.result.reference.seed).toBe(win.result.candidate.seed);
 expect(await runSpeedrun(envelope,['transit'])).toMatchObject({score:0,success:false,placement:null});
 expect(JSON.stringify(envelope)).toBe(before);
 expect(Object.isFrozen(envelope.initialState.households[0])).toBe(true);
});
test('invalid decision counts, missing source, tampering and cancellation cannot place',async()=>{
 const envelope=await speedrunScenario();
 for(const selection of [[],['housing','transit'],['unknown'],['housing','housing']])await expect(runSpeedrun(envelope,selection)).rejects.toThrow('exactly one');
 await expect(runSpeedrun(null,['housing'])).rejects.toThrow();
 const corrupt=structuredClone(envelope);corrupt.seed=7;
 await expect(runSpeedrun(corrupt,['housing'])).rejects.toThrow();
 const controller=new AbortController();
 await expect(runSpeedrun(envelope,['housing'],{signal:controller.signal,onProgress:()=>controller.abort()})).rejects.toMatchObject({name:'AbortError'});
 expect(()=>assertMatchingReplay(null,{})).toThrow('Missing run');
 expect(()=>assertMatchingReplay({score:33},{score:34})).toThrow('Replay mismatch');
});
test('timer pauses without a penalty, target expiry or effect on simulation scoring',()=>{
 let now=0;const timer=decisionTimer(()=>now);
 now=10000;expect(timer.milliseconds()).toBe(0);
 timer.resume();now=75000;expect(timer.milliseconds()).toBe(65000);
 timer.pause();now=1000000;expect(timer.milliseconds()).toBe(65000);
 timer.resume();now+=1000;timer.pause();expect(timer.milliseconds()).toBe(66000);
 timer.reset();expect(timer.milliseconds()).toBe(0);expect(timer.running).toBe(false);
});
test('runner refuses mismatched execution and missing observations, before issuing any receipt',()=>{
 // Isolate module fault injection so other suites keep the genuine City engine.
 const script=`
 import {mock} from 'bun:test';
 import * as actual from './world/challenges/contract.js';
 import fixture from './world/challenges/fixtures/speedrun-v1.json' with {type:'json'};
 const real=await actual.verifyChallenge(fixture,{selection:['housing']});
 let calls=0,mode='mismatch';
 mock.module('./world/challenges/contract.js',()=>({
 validateChallengeEnvelope:actual.validateChallengeEnvelope,
 verifyChallenge:async()=>{const r=structuredClone(real);calls++;
 if(mode==='mismatch'&&calls===2)r.candidate.state.finance.balance++;
 if(mode==='missing'){r.metrics[0].status='unavailable';r.metrics[0].candidate=null;}
 return r;}
 }));
 const {runSpeedrun}=await import('./world/challenges/speedrun.js');
 for(const expected of ['Replay mismatch','Source observations unavailable']){
 let rejected=false;
 try{await runSpeedrun(fixture,['housing']);}catch(e){if(!e.message.includes(expected))throw e;rejected=true;}
 if(!rejected)throw Error('Fault produced a receipt');
 mode='missing';calls=0;
 }
 `;
 const child=Bun.spawnSync([process.execPath,'--no-env-file','-e',script],{cwd:process.cwd()});
 expect(new TextDecoder().decode(child.stderr)).toBe('');
 expect(child.exitCode).toBe(0);
});
