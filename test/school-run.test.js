import {test,expect} from 'bun:test';
import {DEMO,PLANS,compare,execute,replay} from '../world/school-run/model.js';
test('pinned morning succeeds only with executed split outcomes; parents and seeds stay matched',()=>{
 const before=JSON.stringify(DEMO),result=compare(DEMO,'split');
 expect(result.success).toBe(true);expect(result.baseline.totalDelay).toBe(280);expect(result.candidate.totalDelay).toBe(120);
 expect(result.baseline.late).toBe(4);expect(result.candidate.late).toBe(0);
 expect(result.baseline.seed).toBe(result.candidate.seed);expect(result.candidate.trips).toHaveLength(8);
 expect(compare(DEMO,'baseline').success).toBe(false);expect(compare(DEMO,'detour').success).toBe(false);
 expect(JSON.stringify(DEMO)).toBe(before);expect(Object.isFrozen(result.candidate.trips[0])).toBe(true);
 expect(replay(result.candidate)).toEqual(result.candidate);
});
test('every allowed route preserves exclusive crossings, identities, deadlines and causal queue order',()=>{
 for(const plan of Object.keys(PLANS)){
  const run=execute(DEMO,plan);
  expect(run.trips.map(t=>t.id)).toEqual(DEMO.trips.map(t=>t.id));
  for(const crossing of DEMO.crossings){let previous=null;for(const t of run.trips.filter(t=>t.crossing===crossing)){
   expect(t.start).toBeGreaterThanOrEqual(t.ready);expect(t.end-t.start).toBe(t.crossingSeconds);
   expect(t.delay).toBe(t.start-t.ready);expect(t.late).toBe(t.end>t.deadline);
   expect(t.dependsOn).toBe(previous?.eventId??null);if(previous)expect(t.start).toBeGreaterThanOrEqual(previous.end);previous=t;
  }}
  expect(run.totalDelay).toBe(run.trips.reduce((sum,t)=>sum+t.delay,0));
 }
});
test('missing, cancelled, altered source and replay cannot invent scores',()=>{
 for(const source of [null,{...DEMO,trips:[]}])expect(()=>compare(source,'split')).toThrow('No source');
 for(const source of [{...DEMO,seed:703},{...DEMO,version:'future'},{...DEMO,trips:DEMO.trips.slice(1)}])expect(()=>compare(source,'split')).toThrow('Replay mismatch');
 expect(()=>execute(DEMO,'unsafe')).toThrow('Unsupported');
 const controller=new AbortController();controller.abort();expect(()=>compare(DEMO,'split',{signal:controller.signal})).toThrow('Cancelled');
 const altered=structuredClone(execute(DEMO,'split'));altered.trips[0].end++;expect(()=>replay(altered)).toThrow('Replay mismatch');
 const alteredScore=structuredClone(execute(DEMO,'split'));alteredScore.totalDelay=0;expect(()=>replay(alteredScore)).toThrow('Replay mismatch');
});
