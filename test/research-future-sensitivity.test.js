import {test,expect} from 'bun:test';
import {runSensitivity,reconcileHistory} from '../scripts/research-future-sensitivity.mjs';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {stateHash} from '../world/future-machine/data/core.js';

test('bounded research repeats complete histories, reconciles monthly measurements and distinguishes noncompletion',async()=>{
 const result=await runSensitivity({seeds:[0],delays:[0,120]});
 expect(result.status).toBe('passed');expect(result.controls).toHaveLength(1);expect(result.cases).toHaveLength(2);
 expect(result.controls[0].baselineHistoryHash).toBe(result.controls[0].zeroControlHistoryHash);
 expect(result.deterministicHash).toBe(await stateHash({protocol:result.protocol,controls:result.controls,cases:result.cases}));
 expect(result.timing.totalMonthlySteps).toBe(720);
 const [immediate,late]=result.cases;
 for(const row of result.cases){
  expect(row.status).toBe('passed');expect(row.error).toBeNull();expect(row.months.map(frame=>frame.month)).toEqual(Array.from({length:121},(_,month)=>month));
  expect(row.planHistoryHash).toBe(row.repeatedHistoryHash);expect(Object.values(row.checks).every(Boolean)).toBe(true);
  expect(row.months[0].baselineStateHash).toBe(row.months[0].planStateHash);
 }
 expect(immediate.months.flatMap(frame=>frame.completionEvents).map(event=>event.month)).toEqual([16]);
 expect(immediate.months[15].metrics.housingUnits.delta).toBe(0);expect(immediate.months[16].metrics.housingUnits.delta).toBe(24);
 expect(immediate.months[120].metrics.capitalSpending.delta).toBe(1000000);
 expect(late.months.flatMap(frame=>frame.completionEvents)).toEqual([]);
 expect(late.months[120].metrics.housingUnits.delta).toBe(0);
 expect(result.limitations.join(' ')).toContain('not empirical forecasts');
},30000);

test('reconciliation rejects missing months, altered metrics, finance and unsupported completion',()=>{
 const initial=initialForRecipe(),run=createEngine().run(addIntervention(initial,DEFAULT_RECIPE.intervention),120);
 const history=normalizeReplay(initial,run);
 expect(reconcileHistory(history,initial).completions[0].month).toBe(16);
 const corrupt=(month,change)=>{const altered=[...history];altered[month]=structuredClone(history[month]);change(altered[month]);return altered;};
 expect(()=>reconcileHistory(history.slice(1),initial)).toThrow('121');
 expect(()=>reconcileHistory(corrupt(1,row=>row.metrics.housingUnits++),initial)).toThrow('Homes');
 expect(()=>reconcileHistory(corrupt(1,row=>row.state.units[0].rent=NaN),initial)).toThrow(/finite/i);
 expect(()=>reconcileHistory(corrupt(1,row=>row.metrics.meanRent++),initial)).toThrow('Mean rent');
 expect(()=>reconcileHistory(corrupt(1,row=>delete row.state.systems.finance.capitalExpense),initial)).toThrow('ledger');
 expect(()=>reconcileHistory(corrupt(1,row=>row.metrics.capitalSpending++),initial)).toThrow('Cumulative');
 expect(()=>reconcileHistory(corrupt(16,row=>row.events=[]),initial)).toThrow('completion event');
 expect(()=>reconcileHistory(corrupt(15,row=>row.state.buildings.push({id:'unrecorded',districtId:'d1',floors:3})),initial)).toThrow('completed housing');
 const futureUnit=history[16].state.units.find(unit=>!initial.units.some(original=>original.id===unit.id));
 expect(()=>reconcileHistory(corrupt(15,row=>{
  row.state.units.push({...futureUnit,householdId:null,status:'available'});
  row.metrics.housingUnits=row.state.units.length;
  row.metrics.meanRent=row.state.units.reduce((sum,unit)=>sum+unit.rent,0)/row.state.units.length;
 }),initial)).toThrow('Unknown housing building');
 expect(()=>reconcileHistory(corrupt(15,row=>{
  row.state.units.push({...row.state.units[0],id:'premature-unit',householdId:null,status:'available'});
  row.metrics.housingUnits=row.state.units.length;
  row.metrics.meanRent=row.state.units.reduce((sum,unit)=>sum+unit.rent,0)/row.state.units.length;
 }),initial)).toThrow('New unit lacks contemporaneous');
},10000);

test('research rejects unbounded, duplicate or invalid protocol before running',async()=>{
 for(const input of [{seeds:[],delays:[0]},{seeds:[1,1],delays:[0]},{seeds:[-1],delays:[0]},{seeds:[0],delays:[0,0]},{seeds:[0],delays:[121]},{seeds:[0],delays:[0.5]}])await expect(runSensitivity(input)).rejects.toThrow();
});
