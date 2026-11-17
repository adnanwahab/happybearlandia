import {test,expect} from 'bun:test';
import {rotationPanels} from '../world/decision/rotation-theater.js';
import {DECISION_ENGINE_VERSION} from '../world/decision/contracts.js';
const scenarios=['baseline','plan-a','plan-b','stress'].map(kind=>({kind,id:kind}));
const experiment={id:'exp',modelVersion:'1.2.0',years:10,scenarios};
const runs=scenarios.map(s=>({id:s.id+'_0001',scenarioId:s.id,experimentId:'exp',modelVersion:'1.2.0',engineVersion:DECISION_ENGINE_VERSION,seed:42,runIndex:0,status:'completed',metrics:{housing_supply:100}}));
const data={experiment,runs};
test('all four exact receipts reuse immutable same-seed/index records',()=>{
 const before=JSON.stringify(data),panels=rotationPanels(data);
 expect(panels.map(p=>p.run)).toEqual(runs);expect(panels.every(p=>p.receipt.endsWith(p.run.id))).toBe(true);
 expect(JSON.stringify(data)).toBe(before);
});
test('missing and unsupported receipt identities remain unavailable',()=>{
 expect(rotationPanels().every(p=>!p.run)).toBe(true);
 for(const change of [{seed:43},{runIndex:1},{experimentId:'foreign'},{engineVersion:'old'},{modelVersion:'old'},{status:'failed'},{error:'failed'},{metrics:{housing_supply:null}}]){
  const panels=rotationPanels({...data,runs:[...runs.slice(0,3),{...runs[3],...change}]});expect(panels[3].run).toBeNull();expect(panels[0].run).toBe(runs[0]);
 }
 expect(rotationPanels({...data,runs:[...runs,runs[3]]})[3].run).toBeNull();
 expect(rotationPanels({...data,experiment:{...experiment,years:undefined}}).every(p=>!p.run)).toBe(true);
 expect(rotationPanels({...data,experiment:{...experiment,scenarios:scenarios.slice(0,3)}})[3].run).toBeNull();
});
test('selected-future continuations are unsupported rather than silently paired',()=>{
 expect(rotationPanels({...data,experiment:{...experiment,scenarios:scenarios.map(s=>s.kind==='stress'?{...s,timelineFork:{mode:'selected-future'}}:s)}})[3].run).toBeNull();
});
