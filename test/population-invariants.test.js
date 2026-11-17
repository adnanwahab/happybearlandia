import {test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,serializePopulation} from '../world/population/model.js';
import {auditPopulation,distributionDrift} from '../world/population/invariants.js';

test('full state balances through fixed-step days across synthetic configurations',()=>{
 for(const config of [{population:1,seed:0},{population:100,seed:42},{population:100,seed:4294967295,representedPopulation:1000,transitService:0},{population:100,seed:42,employmentRate:0}]){
  const context={buildings:Array.from({length:30},(_,i)=>({id:`b${i}`,center:[i*180,i%4*250]}))};
  const a=createPopulationModel(config,context),b=createPopulationModel(config,context);
  for(let tick=0;tick<=48;tick++){
   if(tick){stepPopulation(a,{tick,minutes:30});stepPopulation(b,{tick,minutes:30});}
   const before=serializePopulation(a),report=auditPopulation(a);
   expect(report.failures).toEqual([]);
   expect(serializePopulation(a)).toEqual(before);
   expect(report).toEqual(auditPopulation(b));
  }
  expect(serializePopulation(a)).toEqual(serializePopulation(b));
 }
});

test('mutations fail independent macro and micro checks',()=>{
 const cases=[
  [m=>m.metrics.syntheticPopulation++, 'population-total'],
  [m=>m.people.household[0]=999, 'household-membership'],
  [m=>m.households.savings[0]=NaN, 'household-resource'],
  [m=>m.people.energy[0]=101, 'need-bound'],
  [m=>m.people.remaining[0]=NaN, 'travel-resource'],
  [m=>m.districts[m.households.home[0]].housingUnits=0, 'housing-capacity'],
  [m=>{const i=m.people.employed.findIndex(v=>v===1);m.districts[m.people.work[i]].jobs=0;}, 'labor-capacity'],
  [m=>m.events.push({id:'future',minute:m.minute+1,tick:0}), 'event-order'],
  [m=>m.traces.set('bad',[{type:'MODE_CHOICE',chosen:'car',alternatives:[{id:'car',available:false,probability:1}]}]), 'mode-choice'],
  [m=>m.districts[0].services=2, 'service-access'],
  [m=>m.totals.trips++, 'trip-mode-balance'],
  [m=>m.totals.completedTrips++, 'trip-flow-balance'],
  [m=>m.odFlows.push({count:1}), 'od-flow-balance'],
  [m=>m.cohorts[0].count++, 'income-cohort-total'],
 ];
 for(const [mutate,rule] of cases){const m=createPopulationModel({population:40});mutate(m);expect(auditPopulation(m).failures.some(f=>f.rule===rule)).toBe(true);}
 expect(()=>auditPopulation({modelVersion:'unknown'})).toThrow('version');
});

test('distribution drift uses proportions and reports missing exposure explicitly',()=>{
 expect(distributionDrift({a:1,b:1},{a:10,b:10})).toBe(0);
 expect(distributionDrift({a:1},{b:1})).toBe(1);
 expect(distributionDrift({a:3,b:1},{a:1,b:3})).toBe(.5);
 expect(distributionDrift({},{a:1})).toBeNull();
 expect(()=>distributionDrift({a:Number.MAX_VALUE,b:Number.MAX_VALUE},{a:1})).toThrow();
 expect(()=>distributionDrift({a:NaN},{a:1})).toThrow();
 expect(()=>distributionDrift({a:-1},{a:1})).toThrow();
});

test('no feasible route records rejection rather than a fabricated choice',()=>{
 const m=createPopulationModel({population:40});
 m.traces.set('denied',[{type:'MODE_CHOICE',chosen:null,reasonCodes:['NO_FEASIBLE_ALTERNATIVE'],alternatives:[{id:'walk',available:false,probability:0}]}]);
 expect(auditPopulation(m).failures).toEqual([]);
 m.traces.get('denied')[0].alternatives[0].probability=1;
 expect(auditPopulation(m).failures.some(f=>f.rule==='mode-choice')).toBe(true);
});
