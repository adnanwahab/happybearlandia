import {test,expect} from 'bun:test';
import fixture from './fixtures/housing-ribbons/crossing.json';
import {housingRibbonData} from '../world/decision/housing-ribbons.js';
import {simulateHousingRun} from '../world/models/housing/index.js';
test('authored crossing cites original annual keys and retains missing demand',()=>{
 const data=housingRibbonData(fixture.experiment,fixture.run);
 expect(data.crossings).toHaveLength(1);expect(data.crossings[0].year).toBe(1.5);
 expect(data.crossings[0].from.demandKey).toBe('events[0].households');
 expect(data.crossings[0].to.supplyKey).toBe('timeline[1].metrics.housing_supply');
 expect(data.rows[2].demand).toBeNull();
 expect(housingRibbonData(fixture.experiment,fixture.run)).toEqual(data);
});
test('missing, duplicate, nonnumeric, wrong-clock and nonadjacent observations never fabricate crossings',()=>{
 for(const bad of [null,'110',Infinity,-1]){
 const run=structuredClone(fixture.run);run.events[0].households=bad;
 expect(housingRibbonData(fixture.experiment,run).crossings).toEqual([]);
 }
 for(const mutate of [r=>r.events.push(r.events[0]),r=>r.events[0].month=13,r=>r.timeline[1].year=4]){
 const run=structuredClone(fixture.run);mutate(run);expect(housingRibbonData(fixture.experiment,run).crossings).toEqual([]);
 }
 expect(housingRibbonData({modelId:'city'},fixture.run).rows).toEqual([]);
});
test('real seeded model ledger remains unchanged and deterministic through adapter',()=>{
 const a=simulateHousingRun({seed:42,years:3}),b=simulateHousingRun({seed:42,years:3});
 const before=JSON.stringify(a);const data=housingRibbonData(fixture.experiment,a);
 expect(data.rows).toHaveLength(3);expect(data).toEqual(housingRibbonData(fixture.experiment,b));
 for(const row of data.rows)expect(row.demand).toBeGreaterThan(0);
 expect(JSON.stringify(a)).toBe(before);
});
