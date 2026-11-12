import {test,expect} from 'bun:test';
import {compareNeighborhood,applyProject,dailyAccess,validateProject} from '../world/what-if/model.js';
import {createPopulationModel} from '../world/population/model.js';
const context={bounds:{minX:-500,maxX:500,minZ:-500,maxZ:500},districts:[{id:'west',label:'West',x:-200,z:0},{id:'east',label:'East',x:200,z:0}],buildings:[{id:'a',kind:'home',center:[-200,0]},{id:'b',kind:'home',center:[200,0]}]};
const input=kind=>({context,project:{kind,x:-200,z:0},config:{population:20,seed:42}});
test('paired days are reproducible, preserve source context and expose actual per-resident deltas',async()=>{
 const original=structuredClone(context),progress=[];
 const a=await compareNeighborhood(input('park'),{onProgress:p=>progress.push(p.completed)}),b=await compareNeighborhood(input('park'));
 expect(a).toEqual(b);expect(context).toEqual(original);expect(progress.at(-1)).toBe(96);expect(a.minutes).toBe(1440);expect(a.residents).toHaveLength(20);
 expect(a.after.access).toBeGreaterThan(a.before.access);
 for(const r of a.residents){expect(r.before.id).toBe(r.after.id);expect(r.delta.access).toBeCloseTo(r.after.access-r.before.access);expect(Number.isFinite(r.delta.burden)).toBe(true);}
},30000);
test('housing scenario changes capacity and rent only after identities and homes have been generated',async()=>{
 const model=createPopulationModel({population:20},context),homes=[...model.people.homeX],rent=model.districts[0].rent,units=model.districts[0].housingUnits;
 applyProject(model,input('housing').project);expect([...model.people.homeX]).toEqual(homes);expect(model.districts[0].housingUnits).toBe(units+40);expect(model.districts[0].rent).toBeCloseTo(rent*.95);
 const r=await compareNeighborhood(input('housing'));expect(r.after.burden).toBeLessThan(r.before.burden);
},30000);
test('each addition maps to an explicit local model input; access requires supplied destinations',()=>{
 for(const kind of ['park','grocery','transit']){const m=createPopulationModel({population:20},context),untouched=structuredClone(m.districts[1]);expect(dailyAccess(m,0)).toBe(0);const before=structuredClone(m.districts[0]);expect(applyProject(m,input(kind).project)).toBe('west');expect(m.districts[1]).toEqual(untouched);if(kind==='transit')expect(m.districts[0].transit).toBe(Math.min(1,before.transit+.2));else expect(m.locations.at(-1).kind).toBe(kind==='park'?'park':'shop');}
});
test('invalid placement, oversized simulations and cancellation reject without a partial result',async()=>{
 expect(()=>validateProject({kind:'park',x:Infinity,z:0},context)).toThrow();expect(()=>validateProject({kind:'park',x:501,z:0},context)).toThrow('inside');expect(()=>validateProject({kind:'unknown',x:0,z:0},context)).toThrow();
 await expect(compareNeighborhood({...input('park'),config:{population:10000,seed:42}})).rejects.toThrow('1–500');
 await expect(compareNeighborhood(input('park'),{isCancelled:()=>true})).rejects.toThrow('cancelled');
});
test('a saturated transit input produces no invented benefit',async()=>{
 const saturated={...context,districts:context.districts.map(d=>({...d,transit:1}))};
 const result=await compareNeighborhood({...input('transit'),context:saturated});
 expect(result.after).toEqual(result.before);
 expect(result.residents.every(r=>r.delta.burden===0&&r.delta.access===0&&(r.delta.commute===null||r.delta.commute===0))).toBe(true);
},30000);
