import {test,expect} from 'bun:test';
import {buildLawImpact,impactPlaces} from '../world/laws/impact.js';
import {getLaw} from '../world/laws/catalog.js';
import {compareLaw} from '../world/laws/comparison.js';

test('unsupported laws expose conditional tradeoffs without inventing beneficiaries, zero costs or onset dates',()=>{
 const report=buildLawImpact({law:getLaw(31),result:{status:'mechanism-unavailable',supported:false}});
 expect(report.completed).toBe(false);expect(report.groups).toEqual([]);expect(report.metrics).toEqual([]);expect(report.horizon).toBeNull();
 expect(report.profile.benefit).toContain('may');expect(report.unknowns.join(' ')).toContain('unavailable');expect(report.timing).toContain('No onset date');
});
test('a real paired run retains mixed and unchanged households and does not assign aggregate benefits to a map building',async()=>{
 const buildings=[{id:'home',name:'Map home',kind:'home',center:[0,0]},{id:'office',kind:'work',center:[100,100]}];
 const result=await compareLaw({lawId:21,seed:42,population:12,months:4,worldContext:{buildings}}),before=JSON.stringify(result);
 const report=buildLawImpact({law:getLaw(21),result,building:buildings[0]});
 expect(report.completed).toBe(true);expect(report.horizon).toBe('4 modeled months');expect(report.groups.reduce((sum,row)=>sum+row.count,0)).toBe(result.analysis.households.length);
 expect(report.groups.find(row=>row.id==='mixed').count).toBe(result.analysis.distribution.mixed.length);
 expect(report.metrics.find(row=>row.id==='entitledCapacity').delta).toBe(result.analysis.scorecard.find(row=>row.id==='entitledCapacity').delta);
 expect(report.place.recorded).toBe(true);expect(report.place.changes.join(' ')).toContain('capacity');expect(report.place).not.toHaveProperty('beneficiaries');
 expect(JSON.stringify(result)).toBe(before);
 const unknown=buildLawImpact({law:getLaw(21),result,building:{id:'other',name:'Another home'}});expect(unknown.place.recorded).toBe(false);expect(unknown.place.changes).toEqual([]);
});
test('unpaired or unsupported results with numerical-looking outputs do not become evidence',()=>{
 const result={status:'completed',supported:true,analysis:{comparison:{comparable:false},distribution:{winners:[{id:'x'}]}},scorecard:[{id:'income',baseline:0,current:10,delta:10}]};
 const report=buildLawImpact({law:getLaw(22),result});expect(report.metrics).toEqual([]);expect(report.groups).toEqual([]);expect(report.completed).toBe(false);
});
test('institution list uses exact source IDs, includes recorded joins outside potential scope and never creates geography',()=>{
 const buildings=[{id:'h',kind:'home'},{id:'w',kind:'work'},{id:'p',kind:'park'}];
 const places=impactPlaces(getLaw(22),{visual:{recordedBuildingIds:['w','missing']}},buildings);
 expect(places.map(p=>p.id)).toEqual(['h','w']);expect(places.find(p=>p.id==='h').recorded).toBe(false);expect(places.find(p=>p.id==='w').recorded).toBe(true);
 expect(impactPlaces(null,null,buildings)).toEqual([]);
});
test('parking tradeoffs preserve unknown parking outcomes and expose zero measured deltas without relabeling them as benefits',()=>{
 const report=buildLawImpact({law:getLaw(22),result:{status:'completed',scorecard:[{id:'rent',baseline:5,selected:5,delta:0}]}});
 expect(report.profile.cost).toContain('does not measure');expect(report.metrics[0].delta).toBe(0);expect(report.groups).toEqual([]);
});

test('switching laws cannot show prior-law measured outcomes',()=>{
 const report=buildLawImpact({law:getLaw(31),result:{law:getLaw(22),status:'completed',scorecard:[{id:'cost',baseline:100,selected:90,delta:-10}]}});
 expect(report.completed).toBe(false);expect(report.metrics).toEqual([]);
});

test('incompatible or prior-law records cannot label places as measured changes',()=>{
 const buildings=[{id:'w',kind:'work'}],visual={recordedBuildingIds:['w']};
 expect(impactPlaces(getLaw(22),{visual,comparable:false},buildings)).toEqual([]);
 expect(impactPlaces(getLaw(22),{visual,law:getLaw(83),status:'completed'},buildings)).toEqual([]);
});
