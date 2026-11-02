import {test,expect} from 'bun:test';
import {scanDiffRadar} from './diff-radar.js';
import {createCity} from '../city/seed.js';
import {compileRealityProposal} from './compiler.js';
import {normalizeRealityRequest,executeRealityExperiment,replayRealityFuture} from './runtime-core.js';
const region={id:'tile',buildings:[{id:'geo-a',sourceId:'osm-a',center:[10,20]},{id:'geo-b',sourceId:'osm-b',center:[30,40]},{id:'outside',center:[50,60]}]};
function comparison(){const baseline={seed:42,month:3,version:'city-fixture',buildings:[{id:'a',sourceId:'osm-a',parcelId:'p',floors:1},{id:'b',sourceId:'osm-b',floors:1}],parcels:[{id:'p',capacity:10,far:2}],units:[{id:'u',buildingId:'a',rent:1000,quality:1}],households:[{id:'h',unitId:'u',savings:1000,income:3000}],finance:{balance:100000,debt:0}},treatment=structuredClone(baseline);treatment.units[0].rent=1100;treatment.households[0].savings=1500;treatment.parcels[0].capacity=30;treatment.finance.balance=90000;return{runId:'real-pair',engine:'city',baseline:{state:baseline},treatment:{state:treatment}};}

test('radar joins stable source IDs and actual unit/household/parcel changes; global finance stays unallocated',()=>{
 const pair=comparison(),before=JSON.stringify(pair),report=scanDiffRadar({regions:[region],comparisons:[pair]});
 expect(report.coverage).toMatchObject({regions:1,geometryBuildings:3,pairedBuildings:2,unmodeledBuildings:1,changedBuildings:1,nonGeographicFields:1});
 expect(report.hotspots).toHaveLength(1);expect(report.hotspots[0]).toMatchObject({sourceId:'osm-a',strength:1,direction:'mixed'});
 expect(report.hotspots[0].changes.map(c=>c.kind).sort()).toEqual(['households','parcels','units']);
 expect(report.unlocated.some(row=>row.kind==='finance')).toBe(true);expect(report.batchProposal.unmodeledBuildings).toBe(1);
 expect(JSON.stringify(pair)).toBe(before);
});

test('missing sparse population records never become zero occupancy or fabricated people',()=>{
 const baseline={minute:60,modelVersion:'1.2.0',buildingOccupancy:[{buildingId:'geo-a',count:5}],visibleAgents:[{id:'p1',commuteMinutes:10}]},treatment={minute:60,modelVersion:'1.2.0',buildingOccupancy:[{buildingId:'geo-b',count:8}],visibleAgents:[{id:'p2',commuteMinutes:99}]};
 const report=scanDiffRadar({regions:[region],comparisons:[{id:'pop',engine:'population',seed:42,baseline,treatment}]});
 expect(report.hotspots).toHaveLength(0);expect(report.coverage.pairedBuildings).toBe(0);expect(report.coverage.unmodeledBuildings).toBe(3);
});

test('ambiguous IDs, mismatched seed/time and duplicate comparisons cannot inflate coverage',()=>{
 const pair=comparison(),bad=structuredClone(pair);bad.runId='bad';bad.treatment.state.seed=99;
 const report=scanDiffRadar({regions:[region],comparisons:[pair,pair,bad]});
 expect(report.coverage).toMatchObject({acceptedComparisons:1,rejectedComparisons:1,duplicateComparisons:1});
 const ambiguous=scanDiffRadar({regions:[{id:'one',buildings:[{id:'a',center:[0,0]}]},{id:'two',buildings:[{id:'a',center:[100,100]}]}],comparisons:[pair]});
 expect(ambiguous.hotspots).toHaveLength(0);expect(ambiguous.coverage.ambiguousGeometryAliases).toBe(1);
});

test('entire100000-building scan is indexed and top output is explicitly bounded',()=>{
 const buildings=Array.from({length:100000},(_,i)=>({id:`geo-${i}`,sourceId:`osm-${i}`,center:[i,0]})),baseline={seed:1,month:1,version:'city-fixture',buildings:[{id:'model',sourceId:'osm-99999',floors:1}]},current=structuredClone(baseline);current.buildings[0].floors=4;
 const report=scanDiffRadar({regions:[{id:'large',buildings}],comparisons:[{id:'large-pair',baseline,current}],limit:1});
 expect(report.coverage).toMatchObject({geometryBuildings:100000,pairedBuildings:1,unmodeledBuildings:99999});expect(report.hotspots[0].sourceId).toBe('osm-99999');
 expect(()=>scanDiffRadar({regions:[{id:'oversize',buildings:[...buildings,{id:'extra'}]}]})).toThrow('100000');
},10000);

test('actual runtime reconstruction can be scanned without advancing either model',async()=>{
 const initial=createCity({households:3}),program=compileRealityProposal('Build housing'),result=await executeRealityExperiment(normalizeRealityRequest({initial,program,runs:1,months:4,parameterUncertainty:[]})),replay=await replayRealityFuture(result,{runId:result.runs[0].runId});
 const supplied={id:'actual-city',buildings:initial.buildings.map((b,i)=>({...b,center:[i*10,0]}))},before=JSON.stringify(replay);
 const report=scanDiffRadar({regions:[supplied],comparisons:[replay]});expect(report.coverage.acceptedComparisons).toBe(1);expect(report.coverage.pairedBuildings).toBe(initial.buildings.length);expect(JSON.stringify(replay)).toBe(before);
});
