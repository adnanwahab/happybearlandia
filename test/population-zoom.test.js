import {test,expect} from 'bun:test';
import {zoomEvidence,zoomProjection} from '../world/population/zoom.js';
const fixture={minute:12,metrics:{representedPopulation:1000000,syntheticPopulation:2},districts:[{id:'d',x:0,z:0,population:2,representedPopulation:1000000}],visibleAgents:[{id:'b',homeDistrictId:'d',x:20,z:10,weight:500000},{id:'a',homeDistrictId:'d',x:10,z:5,weight:500000}]};
test('stable sample identity, totals and no mutation or invented history',()=>{const before=JSON.stringify(fixture),e=zoomEvidence(fixture);expect(e.person.id).toBe('a');expect(e.represented).toBe(1000000);expect(zoomEvidence({...fixture,visibleAgents:[...fixture.visibleAgents].reverse()}).person.id).toBe('a');expect(e.person.history).toBeUndefined();expect(JSON.stringify(fixture)).toBe(before);});
test('projection continuous at district stop and exactly reversible',()=>{const e=zoomEvidence(fixture),start=zoomProjection(e,0);expect(zoomProjection(e,1-1e-6).span).toBeCloseTo(zoomProjection(e,1+1e-6).span,6);expect(zoomProjection(e,2)).toMatchObject({x:10,z:5});expect(zoomProjection(e,2).span).toBeCloseTo(30,10);for(let t=2;t>=0;t-=.1)expect(Number.isFinite(zoomProjection(e,t).span)).toBe(true);expect(zoomProjection(e,0)).toEqual(start);});
test('missing population or unmapped resident stays unavailable',()=>{expect(zoomEvidence(null).person).toBeNull();expect(zoomEvidence({visibleAgents:fixture.visibleAgents}).represented).toBeUndefined();expect(zoomEvidence({visibleAgents:fixture.visibleAgents}).person).toBeNull();expect(Number.isFinite(zoomProjection(zoomEvidence(null),2).span)).toBe(true);});
test('home cohort uses exact mapping, bounded stable IDs and missing stays missing',()=>{
 const frame={...fixture,visibleAgents:Array.from({length:20},(_,i)=>({id:`p${String(i).padStart(2,'0')}`,homeDistrictId:'d',x:i,z:0}))};
 const before=JSON.stringify(frame),a=zoomEvidence(frame,'d');
 expect(a.representatives.map(p=>p.id)).toEqual(Array.from({length:12},(_,i)=>`p${String(i).padStart(2,'0')}`));
 expect(zoomEvidence({...frame,visibleAgents:[...frame.visibleAgents].reverse()},'d').representatives).toEqual(a.representatives);
 expect(zoomEvidence(frame,'missing').representatives).toEqual([]);
 expect(zoomEvidence({...frame,visibleAgents:[]},'d').district.id).toBe('d');
 expect(JSON.stringify(frame)).toBe(before);
});
