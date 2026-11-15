import {test,expect} from 'bun:test';
import {createMayorChallenge,mayorAllocation,createMayorTimer,MAYOR_DECISIONS} from '../world/challenges/mayor.js';
import {verifyChallenge} from '../world/challenges/contract.js';
import {createCity} from '../world/city/seed.js';
const modest=['homes-small','transit-small','protection-small'];
test('three decisions enforce one supported intervention per trade-off and a hard allocation cap',async()=>{
 const envelope=await createMayorChallenge();
 expect(envelope.initialState.households).toHaveLength(30);expect(envelope.seed).toBe(42);expect(envelope.months).toBe(12);
 expect(MAYOR_DECISIONS).toHaveLength(3);
 expect(mayorAllocation(envelope,modest)).toEqual({committed:15000,remaining:10000,withinCap:true});
 expect(mayorAllocation(envelope,['homes-large','transit-large','protection-large']).withinCap).toBe(false);
 for(const choices of [[],modest.slice(1),['homes-small','homes-large','transit-small'],['bad','transit-small','protection-small']])expect(()=>mayorAllocation(envelope,choices)).toThrow();
});
test('mayor futures use the exact frozen source, seed, clock and reproducible engine outcomes',async()=>{
 const initial=createCity({households:30,seed:42}),before=JSON.stringify(initial),envelope=await createMayorChallenge(initial),frozen=JSON.stringify(envelope);
 const first=await verifyChallenge(envelope,{selection:modest}),second=await verifyChallenge(envelope,{selection:modest});
 expect(first).toEqual(second);expect(first.candidate.selection).toEqual([...modest].sort());
 expect(first.reference.initialHash).toBe(first.candidate.initialHash);expect(first.reference.seed).toBe(first.candidate.seed);
 expect(first.reference.startMonth).toBe(initial.month);expect(first.candidate.endMonth).toBe(initial.month+12);
 expect(first.candidate.capitalLedger).toHaveLength(12);expect(first.budget.candidateSpent).toBe(15000);
 expect(JSON.stringify(initial)).toBe(before);expect(JSON.stringify(envelope)).toBe(frozen);
});
test('missing city refuses preparation; missing trips and aborted runs cannot claim success',async()=>{
 await expect(createMayorChallenge({districts:[]})).rejects.toThrow('no district');
 const initial=createCity({households:1,seed:42}),envelope=await createMayorChallenge({...initial,workers:[],jobs:[]}),result=await verifyChallenge(envelope,{selection:modest});
 expect(result.status).toBe('metrics-unavailable');expect(result.won).toBe(false);
 const abort=new AbortController();abort.abort();await expect(verifyChallenge(envelope,{selection:modest},{signal:abort.signal})).rejects.toMatchObject({name:'AbortError'});
});
test('optional timer starts paused, pauses without lost time, and expires without gating a run',()=>{
 let time=0;const timer=createMayorTimer(()=>time);time=20000;expect(timer.read()).toBe(300000);
 timer.start();time+=10000;expect(timer.read()).toBe(290000);timer.pause();time+=60000;expect(timer.read()).toBe(290000);
 timer.start();time+=400000;expect(timer.read()).toBe(0);timer.reset();expect(timer.read()).toBe(300000);
});
