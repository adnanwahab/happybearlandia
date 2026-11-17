import {test,expect} from 'bun:test';
import {createDemoDrill,validateDrill,runDrill,replayDrill,gradeRun} from '../world/challenges/crisis.js';
const fixture=()=>Bun.file(new URL('../world/challenges/crisis-demo.v1.json',import.meta.url)).json();
test('pinned authored fixture matches source recipe and freezes all checkpoints',async()=>{
 const source=await fixture();expect(source).toEqual(await createDemoDrill());const scenario=await validateDrill(source);expect(Object.isFrozen(scenario.challenges[0].initialState.households[0])).toBe(true);
 const before=JSON.stringify(source),receipt=await runDrill(source,'drainage');expect(JSON.stringify(source)).toBe(before);
 expect(receipt.runs.map(r=>r.seed)).toEqual([42,73,101]);expect(Object.isFrozen(receipt.runs[0].result.candidate.state)).toBe(true);
 for(const r of receipt.runs){expect(r.result.candidate.initialHash).toBe(r.result.reference.initialHash);expect(r.result.candidate.seed).toBe(r.result.reference.seed);expect(r.result.candidate.capitalLedger).toHaveLength(12);expect(r.result.candidate.state.month).toBe(12);}
});
test('real City integration: seed 42 meets objectives; seed 101 fails housing threshold without moral scoring',async()=>{
 const receipt=await runDrill(await fixture(),'reserve');expect(receipt.runs.map(r=>r.grade.status)).toEqual(['objectives-met','objectives-met','objectives-not-met']);expect(receipt.runs.map(r=>r.result.candidate.unhousedHouseholds)).toEqual([1,1,2]);expect(await replayDrill(receipt)).toEqual(receipt);
 const alternative=await runDrill(receipt.scenario,'homes');expect(alternative.runs[0].result.budget.candidateSpent).toBe(4000);expect(receipt.choice).toBe('reserve');expect(receipt.runs[0].result.budget.candidateSpent).toBe(0);
});
test('no source, changed model/seed/objective/outcome and illegal choices never invent results',async()=>{
 await expect(runDrill(null,'reserve')).rejects.toThrow('No source data');
 for(const edit of [s=>s.challenges[0].seed++,s=>s.objectives='Anything wins',s=>s.challenges[0].engineVersion='unknown']){const s=await fixture();edit(s);await expect(runDrill(s,'reserve')).rejects.toThrow('mismatch');}
 await expect(runDrill(await fixture(),'both')).rejects.toThrow('exactly one');const receipt=structuredClone(await runDrill(await fixture(),'reserve'));receipt.runs[0].result.candidate.state.month=99;await expect(replayDrill(receipt)).rejects.toThrow('Replay mismatch');
});
test('missing observations remain unavailable and cancellation yields no partial receipt',async()=>{
 const receipt=await runDrill(await fixture(),'reserve'),run=structuredClone(receipt.runs[0].result);run.metrics[0].candidate=null;expect(gradeRun(run)).toEqual({status:'unavailable',missing:['unhousedHouseholds']});
 run.metrics=[];expect(gradeRun(run).status).toBe('unavailable');
 const controller=new AbortController();await expect(runDrill(await fixture(),'homes',{signal:controller.signal,onProgress:()=>controller.abort()})).rejects.toMatchObject({name:'AbortError'});
 const cancelled=new AbortController();cancelled.abort();await expect(runDrill(await fixture(),'homes',{signal:cancelled.signal})).rejects.toMatchObject({name:'AbortError'});
});
