import {test,expect} from 'bun:test';
import {buildingsUnderBrush,createPaintedRegionFork} from '../world/reality/region-fork.js';
import {projector} from '../world/gen.js';
import {validateState} from '../world/city/contracts.js';
import {createEngine} from '../world/city/engine.js';
const box=(id,x,z,kind='home')=>({id,kind,poly:[[x,z],[x+10,z],[x+10,z+10],[x,z+10]],center:[x+5,z+5],levels:2});
const fixture=()=>({origin:{lat:29.7286,lng:-95.4746},source:'osm',seedKey:'fixture-town',buildings:[box('way-1',0,0),box('way-2',30,0),box('shop',0,30,'shop'),box('park',30,30,'park'),box('outside',1000,1000)],people:[{id:1,home:0,householdId:'family-a',money:500,journal:'DAILY_SECRET'},{id:2,home:0,householdId:'family-a'},{id:3,home:1,householdId:'family-b'},{id:4,home:4,householdId:'outside-family'}],finance:{balance:987654},households:[{id:'family-a',cash:10000}]});
test('brush uses circle-edge/interior intersection, tangency and connected strokes, and excludes parks',()=>{
 const buildings=[box('a',0,0),box('park',0,0,'park'),box('far',100,100)];
 expect(buildingsUnderBrush({buildings,points:[[5,5]],radius:0})).toEqual(['a']);
 expect(buildingsUnderBrush({buildings,points:[{x:-5,z:5}],radius:5})).toEqual(['a']);
 expect(buildingsUnderBrush({buildings,points:[[-5,5]],radius:4.99})).toEqual([]);
 expect(buildingsUnderBrush({buildings,points:[[-20,5],[30,5]],radius:0})).toEqual(['a']);
 expect(buildingsUnderBrush({buildings,points:[[-1,-1]],radius:Math.SQRT2})).toEqual(['a']);
 const concave={id:'notch',kind:'home',poly:[[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]]};
 expect(buildingsUnderBrush({buildings:[concave],points:[[5,8]],radius:.5})).toEqual([]);expect(buildingsUnderBrush({buildings:[concave],points:[[5,8]],radius:2})).toEqual(['notch']);
});
test('fork preserves exact local polygons and source IDs with correct geographic round trip and detached frozen state',()=>{
 const town=fixture(),before=structuredClone(town),fork=createPaintedRegionFork({town,buildingIds:['way-2','way-1'],seed:7,policyText:'Make housing affordable without increasing taxes.'});
 expect(fork.schemaVersion).toBe('reality-region.v1');expect(fork.manifest.selectedBuildingIds).toEqual(['way-1','way-2']);expect(fork.initial.buildings.map(b=>b.id)).toEqual(['way-1','way-2']);validateState(fork.initial);
 const project=projector(town.origin);for(const building of fork.initial.buildings){const original=town.buildings.find(b=>b.id===building.id);expect(building.sourceId).toBe(original.id);expect(building.localFootprint).toEqual(original.poly);expect(fork.worldContext.buildings.find(b=>b.id===original.id).poly).toEqual(original.poly);for(const[i,p]of original.poly.entries()){const [lng,lat]=building.geometry.coordinates[0][i],xy=project.toXZ(lat,lng);expect(xy[0]).toBeCloseTo(p[0],6);expect(xy[1]).toBeCloseTo(p[1],6);}}
 expect(fork.program.engine).toBe('city');expect(Object.isFrozen(fork.initial)).toBe(true);expect(()=>{fork.worldContext.buildings[0].poly[0][0]=999;}).toThrow();expect(town).toEqual(before);expect(fork).toEqual(createPaintedRegionFork({town,buildingIds:['way-1','way-2'],seed:7,policyText:fork.program.sourceText}));
 const next=createEngine().run(fork.initial,1).state;expect(next.month).toBe(1);expect(fork.initial.month).toBe(0);expect(town).toEqual(before);
});
test('household counts deduplicate selected home assignments and never copy wallets, identities or outside geography',()=>{
 const town=fixture(),fork=createPaintedRegionFork({town,buildingIds:['way-1','shop']});expect(fork.initial.households.length).toBe(1);expect(fork.manifest.sourceHouseholdCount).toBe(1);expect(fork.manifest.sourceResidentCount).toBe(2);expect(fork.manifest.sourceHouseholdIds).toEqual(['family-a']);expect(fork.initial.households[0].id).not.toBe('family-a');expect(JSON.stringify(fork)).not.toContain('DAILY_SECRET');expect(JSON.stringify(fork)).not.toContain('outside-family');expect(fork.initial.finance.balance).toBe(10000000);expect(fork.manifest.regionalBudget.initialFinance.balance).not.toBe(town.finance.balance);expect(fork.manifest.continuationOfLiveLedger).toBe(false);expect(fork.manifest.boundary.kind).toBe('closed');expect(fork.worldContext.roads).toEqual([]);
 const ids=new Set(fork.initial.districts.map(d=>d.id));expect(fork.initial.links.every(l=>ids.has(l.from)&&ids.has(l.to))).toBe(true);expect(fork.worldContext.buildings.some(b=>b.id==='outside')).toBe(false);
});
test('unoccupied/nonhome selection uses the explicit one-household synthetic fallback without mislabeling source geometry',()=>{
 const town=fixture();town.source='synthetic';const fork=createPaintedRegionFork({town,buildingIds:['shop']});expect(fork.manifest.sourceHouseholdCount).toBe(0);expect(fork.manifest.modeledHouseholds).toBe(1);expect(fork.initial.households.length).toBe(1);expect(fork.manifest.householdCountBasis).toContain('fallback');expect(fork.initial.provenance.geometrySource).not.toBe('OpenStreetMap');expect(fork.initial.provenance.type).toBe('synthetic-assumption');expect(fork.initial.buildings[0].source).toBe('synthetic-town');
 const missing=fixture();missing.people=[{home:0}];const noIdentity=createPaintedRegionFork({town:missing,buildingIds:['way-1']});expect(noIdentity.manifest.missingSourceHouseholdIds).toBe(1);expect(noIdentity.manifest.sourceHouseholdCount).toBe(0);
});
test('selection and household limits reject rather than truncate; exact cap334 remains representable',()=>{
 const town=fixture();town.people=Array.from({length:334},(_,i)=>({home:0,householdId:`h${i}`}));expect(createPaintedRegionFork({town,buildingIds:['way-1']}).initial.households.length).toBe(334);town.people.push({home:0,householdId:'h334'});expect(()=>createPaintedRegionFork({town,buildingIds:['way-1']})).toThrow('334');
 const many=Array.from({length:201},(_,i)=>box(`b${i}`,i*12,0));expect(()=>createPaintedRegionFork({town:{...fixture(),buildings:many},buildingIds:many.map(b=>b.id)})).toThrow('200');expect(()=>buildingsUnderBrush({buildings:many,points:[[1000,0]],radius:2000})).toThrow('200');
});
test('invalid IDs, parks, malformed polygons and invalid projection/brush inputs reject explicitly',()=>{
 const town=fixture();for(const ids of[[],['missing'],['park'],['way-1','way-1']])expect(()=>createPaintedRegionFork({town,buildingIds:ids})).toThrow();expect(()=>createPaintedRegionFork({town:{...town,origin:{lat:90,lng:0}},buildingIds:['way-1']})).toThrow();expect(()=>createPaintedRegionFork({town,buildingIds:['way-1'],seed:-1})).toThrow();
 const malformed={...town,buildings:[{id:'bad',kind:'home',poly:[[0,0],[0,0],[0,0]]}]};expect(()=>createPaintedRegionFork({town:malformed,buildingIds:['bad']})).toThrow('polygon');expect(buildingsUnderBrush({buildings:malformed.buildings,points:[[0,0]],radius:1})).toEqual([]);
 for(const input of[{points:[],radius:1},{points:[[0,0]],radius:-1},{points:[[Infinity,0]],radius:1},{points:Array.from({length:513},()=>[0,0]),radius:1}])expect(()=>buildingsUnderBrush({buildings:town.buildings,...input})).toThrow();
});
