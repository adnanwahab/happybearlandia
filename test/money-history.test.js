import {test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,snapshotPopulation,serializePopulation,restorePopulation,inspectHousehold} from '../world/population/model.js';
import {recordMovingPayment} from '../world/population/money-history.js';
import {summarizeMoney} from '../world/money-history-view.js';
test('daily payments reconcile actual savings and pay sources survive restore',()=>{
 const model=createPopulationModel({population:40});
 const opening=Array.from(model.households.savings);
 stepPopulation(model,{tick:1,minutes:1440});
 const restored=restorePopulation(serializePopulation(model));
 const snapshot=snapshotPopulation(model);
 expect(snapshot.households.length).toBeGreaterThan(0);
 let wages=0;
 for(const household of snapshot.households){const r=household.moneyHistory,h=Number(household.id.split('-h').at(-1));expect(r.openingSavings).toBeCloseTo(opening[h],8);expect(r.closingSavings).toBeCloseTo(household.savings,8);expect(r.entries.reduce((s,e)=>s+e.amount,0)).toBeCloseTo(r.closingSavings-r.openingSavings,8);const sources=r.sources.filter(s=>s.category==='wages');expect(sources.reduce((s,e)=>s+e.amount,0)).toBeCloseTo(r.entries.find(e=>e.category==='wages').amount,8);wages+=sources.length;for(const source of sources){expect(source.personId).toBe(source.person.id);expect(model.economy.businesses.some(b=>b.id===source.businessId)).toBe(true)}expect(inspectHousehold(model,h).moneyHistory).toEqual(r);}
 expect(wages).toBeGreaterThan(0);
 stepPopulation(model,{tick:2,minutes:1440});stepPopulation(restored,{tick:2,minutes:1440});expect(snapshotPopulation(restored).households).toEqual(snapshotPopulation(model).households);
 const r=model.moneyHistory.latest[0];model.households.savings[0]-=123;recordMovingPayment(model,0,123);expect(r.entries.at(-1)).toEqual({category:'moving',amount:-123});expect(r.entries.reduce((s,e)=>s+e.amount,0)).toBeCloseTo(r.closingSavings-r.openingSavings,8);
});
test('money summary identifies costs and gaps without inventing missing payments',()=>{const records=[{minute:1440,openingSavings:100,closingSavings:90,entries:[{category:'rent',amount:-20},{category:'wages',amount:10}]},{minute:4320,openingSavings:70,closingSavings:60,entries:[{category:'food',amount:-10}]}];expect(summarizeMoney(records)).toEqual({totals:{rent:-20,wages:10,food:-10},net:-20,gaps:1});});
test('job loss is attached to its household while prior earnings keep the actual employer',()=>{
 const model=createPopulationModel({population:40});model.config.layoffRate=1;model.config.hiringRate=0;
 stepPopulation(model,{tick:1,minutes:1440});
 const rows=snapshotPopulation(model).households.map(h=>h.moneyHistory),loss=rows.find(r=>r.events.some(e=>e.type==='JOB_LOST'));
 expect(loss).toBeDefined();expect(loss.events.filter(e=>e.type==='JOB_LOST').every(e=>loss.memberIds.includes(e.personId))).toBe(true);
 const paid=rows.flatMap(r=>r.sources).filter(s=>s.category==='wages');expect(paid.length).toBeGreaterThan(0);expect(paid.every(s=>s.businessId&&s.business.id===s.businessId)).toBe(true);
});
