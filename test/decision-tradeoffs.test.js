import { test, expect } from 'bun:test';
import { policyTradeoffs } from '../world/decision/tradeoffs.js';
const model = {id:'housing',version:'1',metrics:[{id:'homes',unit:'homes',direction:'higher'},{id:'cost',unit:'USD',direction:'lower'},{id:'unknown',unit:'x'}]};
const experiment = {id:'e',modelId:'housing',modelVersion:'1',scenarios:[{id:'b',kind:'baseline'},{id:'p'}]};
const run = (id,seed,homes,cost=1) => ({id:id+seed,experimentId:'e',scenarioId:id,seed,modelVersion:'1',status:'completed',metrics:{homes,cost}});
const data = {model,experiment,runs:[run('b',1,2),run('p',1,3,2),run('b',2,2),run('p',2,1),run('b',3,2),run('p',3,2)]};
test('balanced cards preserve disagreement, ties, native directions and exact source records',()=>{
 const before=JSON.stringify(data), result=policyTradeoffs(data,'p');
 expect(result.rows[0].counts).toEqual({good:1,bad:1,unchanged:1});
 expect(result.rows[1].counts).toEqual({good:0,bad:1,unchanged:2});
 expect(result.rows[0].cases[0].base.id).toBe('b1');
 expect(result.unavailable).toEqual(['unknown']);expect(JSON.stringify(data)).toBe(before);
});
test('missing, failed, duplicate, foreign, unpaired and version mismatch never become ties',()=>{
 for(const patch of [{metrics:{homes:null}},{status:'failed'},{modelVersion:'2'},{experimentId:'other'},{seed:99}]){
 const result=policyTradeoffs({...data,runs:[run('b',1,2),{...run('p',1,2),...patch}]},'p');
 expect(result.rows.flatMap(r=>r.cases)).toEqual([]);
 }
 expect(policyTradeoffs({...data,runs:[run('b',1,2),run('b',1,2),run('p',1,2)]},'p').rows).toEqual([]);
 expect(policyTradeoffs({...data,experiment:{...experiment,modelVersion:'2'}},'p').rows).toEqual([]);
 expect(policyTradeoffs(data,'b').rows).toEqual([]);expect(policyTradeoffs().rows).toEqual([]);
});

test('incompatible history forks and engine/model identities stay unranked',()=>{
 for(const patch of [{timelineFork:{mode:'selected-future'}},{engineVersion:'other'}]) expect(policyTradeoffs({...data,runs:[run('b',1,2),{...run('p',1,3),...patch}]},'p').rows).toEqual([]);
 expect(policyTradeoffs({...data,experiment:{...experiment,modelId:'other'}},'p').rows).toEqual([]);
});
