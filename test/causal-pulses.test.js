import { test, expect } from 'bun:test';
import { selectPulses, PULSE_LIMIT } from '../world/causality/pulses.js';
const nodes = Array.from({length: 15}, (_, i) => ({id: `event:${i}`, type:'transition', context:{runId:'r',tick:i},entityIds:[`building:${i}`]}));
const edges = nodes.slice(1).map((node,i)=>({id:`edge:${i}`,fromId:nodes[i].id,toId:node.id,relation:'contributes',evidenceIds:[nodes[i].id]}));
test('bounded deterministic selection retains resolvable event and evidence IDs',()=>{
 const result=selectPulses(nodes,edges,nodes,'event:14');
 expect(result.edges).toHaveLength(PULSE_LIMIT); expect(result.eligible).toBe(14);
 expect(selectPulses(nodes,[...edges].reverse(),nodes,'event:14')).toEqual(result);
 for(const edge of result.edges) expect(nodes.some(n=>n.id===edge.fromId)).toBe(true);
});
test('never animates associations, missing evidence/endpoints, cross-run or reversed time',()=>{
 for(const patch of [{relation:'correlates'},{evidenceIds:[]},{evidenceIds:['missing']},{fromId:'missing'},{fromId:'event:14'}])
 expect(selectPulses(nodes,[{...edges[0],...patch}],nodes,'event:1').edges).toEqual([]);
 expect(selectPulses(nodes.map((n,i)=>i===0?{...n,context:{...n.context,runId:'other'}}:n),[edges[0]],nodes,'event:1').edges).toEqual([]);
 expect(selectPulses(nodes,[edges[0]],nodes,'event:14').edges).toEqual([]);
});
