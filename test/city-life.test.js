import {test,expect} from 'bun:test';
import {collectLife,summarizeLife} from '../world/city/life.js';
const manifest={runs:30,months:120,initial:{month:0,seed:4294967290,households:[{id:'h'}]},scenarios:[{id:'baseline'},{id:'plan'}]};
test('sequential matched seeds preserve identity and explicit departures',async()=>{
 let active=0,max=0;
 const rows=await collectLife(manifest,'h',async(arm,index)=>{
  active++;max=Math.max(max,active);await Promise.resolve();active--;
  return {state:{month:120,seed:(manifest.initial.seed+index)>>>0,households:index===2?[]:[{id:'h',income:100,savings:index+(arm==='plan'?10:0),unitId:'u'}],units:[{id:'u',householdId:'h',rent:30}]}};
 });
 expect(max).toBe(1);expect(rows).toHaveLength(60);expect(rows[12].seed).toBe(0);expect(rows[4].status).toContain('departed');expect(summarizeLife(rows,['baseline','plan']).savings.n).toBe(29);
});
test('balanced variance separates arm and seed spread',()=>{
 const rows=Array.from({length:30},(_,index)=>['a','b'].map((arm,a)=>({index,arm,savings:index%2*2+a*10,burden:null}))).flat();
 const s=summarizeLife(rows,['a','b']);expect(s.savings.policyVariance).toBe(25);expect(s.savings.luckVariance).toBe(1);expect(s.savings.pairedDifference).toBe(10);expect(s.burden.n).toBe(0);
});
test('rejects unsupported identity, horizon and seed',async()=>{
 await expect(collectLife(manifest,'other',()=>{})).rejects.toThrow('identity');
 await expect(collectLife({...manifest,months:24},'h',()=>{})).rejects.toThrow('120');
 await expect(collectLife(manifest,'h',async()=>({state:{month:120,seed:2,households:[]}}))).rejects.toThrow('seed');
});
