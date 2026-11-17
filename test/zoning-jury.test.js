import {test,expect} from 'bun:test';
import demo from '../world/city/jury/demo.json';
import {replayJury,scoreJury,freeze} from '../world/city/jury/model.js';

test('authored City housing pair replays exact pinned metric checkpoints and recomputes final vote',async()=>{
 const before=JSON.stringify(demo);
 for(const id of ['housing','zoning']){
  const replay=await replayJury(id);
  expect(replay).toEqual(demo[id]);
  expect(Object.isFrozen(replay.plan.metrics)).toBe(true);
  const score=scoreJury(replay,demo[id]);
  expect(score.status).toBe('verified');
  expect(score.positions.map(p=>p.id)).toEqual(['renters','services','treasury']);
  expect(score.support).toBe(id==='housing'?2:1);
  expect(score.success).toBe(false);
 }
 expect(JSON.stringify(demo)).toBe(before);
});

test('explicit synthetic preference fixture succeeds only when all three rules support',()=>{
 // Scoring boundary fixture, not an executed City outcome or a citizen survey.
 const record=structuredClone(demo.housing);
 record.plan.metrics.overloadedServices=record.baseline.metrics.overloadedServices-1;
 const score=scoreJury(freeze(record),structuredClone(record));
 expect(score.success).toBe(true);expect(score.support).toBe(3);
 const fail=structuredClone(record);fail.plan.metrics.meanRent=fail.baseline.metrics.meanRent+1;
 expect(scoreJury(fail,structuredClone(fail)).success).toBe(false);
 expect(scoreJury(fail,structuredClone(fail)).positions[0].current.vote).toBe('oppose');
});

test('missing, mismatched version/seed/month and absent metric evidence never invent votes',()=>{
 expect(scoreJury(null,demo.housing).support).toBeNull();
 for(const alter of [r=>r.plan.seed++,r=>r.plan.month++,r=>r.plan.modelVersion='old',r=>r.plan.metrics.meanRent++,r=>delete r.plan.metrics.meanRent]){
  const record=structuredClone(demo.housing);alter(record);
  expect(scoreJury(record,demo.housing).status).toBe('unavailable');
  expect(scoreJury(record,demo.housing).success).toBeNull();
 }
 const missing=structuredClone(demo.housing);delete missing.plan.metrics.meanRent;
 expect(scoreJury(missing,structuredClone(missing)).status).toBe('unavailable');
});

test('cancel interrupts replay without publishing a partial record',async()=>{
 const controller=new AbortController();let steps=0;
 await expect(replayJury('housing',{signal:controller.signal,yieldStep:async()=>{if(++steps===2)controller.abort();}})).rejects.toThrow('Cancelled');
 expect(steps).toBe(2);
 await expect(replayJury('unknown')).rejects.toThrow('Unknown');
});

import {mountJury} from '../world/city/jury/view.js';
function ui(dependencies={}){
 const doc={createElement(tag){return {tag,textContent:'',children:[],disabled:false,value:tag==='select'?'housing':'',ownerDocument:doc,setAttribute(){},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;}};}};
 const root=doc.createElement('section');const lifecycle=mountJury(root,{load:async()=>structuredClone(demo),replay:async option=>structuredClone(demo[option]),...dependencies});
 const find=text=>root.children.find(n=>n.textContent===text);
 return {root,lifecycle,run:find('Run pinned jury demo'),cancel:find('Cancel jury'),clear:find('Clear jury evidence'),select:root.children.find(n=>n.tag==='select'),status:root.children.find(n=>n.textContent.startsWith('No source data')),result:root.children.at(-1)};
}
test('real mounted navigation reveals three viewpoints, then revision and clear retire evidence',async()=>{
 const x=ui();await x.run.onclick();
 expect(x.status.textContent).toContain('2 / 3 support');
 expect(x.result.children.filter(n=>n.tag==='article')).toHaveLength(3);
 x.select.value='zoning';x.select.onchange();expect(x.result.children).toHaveLength(0);
 await x.run.onclick();expect(x.status.textContent).toContain('1 / 3 support');
 x.clear.onclick();expect(x.status.textContent).toContain('No source data');
 x.lifecycle.destroy();expect(x.run.onclick).toBeNull();
});
test('mounted cancel blocks late completion and missing/mismatch states show no cards',async()=>{
 let finish;const x=ui({load:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=x.run.onclick();x.cancel.onclick();finish(structuredClone(demo));await pending;
 expect(x.status.textContent).toContain('Cancelled');expect(x.result.children).toHaveLength(0);
 for(const dependencies of [{load:async()=>{throw Error('No source data');}},{replay:async()=>({...demo.housing,version:'old'})}]){
  const view=ui(dependencies);await view.run.onclick();expect(view.result.children).toHaveLength(0);
  expect(view.status.textContent).toMatch(/No source data|Replay mismatch/);
 }
});
