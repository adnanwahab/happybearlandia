import {test, expect} from 'bun:test';
import {createPinboard, spatialRecord, comparisonRows} from '../world/comparison-pinboard.js';
const town={seedKey:'town-seed',source:'osm',buildings:[{id:'way/1',name:'One',area:0,height:12},{id:'way/2',name:'Two',area:40,height:NaN,levels:2}]};
const world={t:360,seed:'run-469',modelVersion:'test-v1',getActivitySnapshot:()=>({seed:'run-469',runId:'legacy:fixture-469'}),people:[{id:'p1',name:'Synthetic',age:30,needs:{energy:0}}]};
const record=id=>spatialRecord(town,world,'building',id);
test('retains exact identities and detached capture provenance without touching source state',()=>{
 const before=JSON.stringify({town,world});const board=createPinboard();expect(board.capture(record('way/1'))).toBe(false);
 board.start();const a=record('way/1');expect(board.capture(a)).toBe(true);a.id='changed';
 world.t=361;expect(board.capture(record('way/2'))).toBe(true);expect(board.state().active).toBe(false);
 expect(board.state().pins.map(p=>p.id)).toEqual(['way/1','way/2']);expect(board.state().pins.map(p=>p.minute)).toEqual([360,361]);
 expect(board.state().pins[0]).toMatchObject({seed:'run-469',runId:'legacy:fixture-469',townSeed:'town-seed',modelVersion:'test-v1',authority:'legacy-world'});
 world.t=360;expect(JSON.stringify({town,world})).toBe(before);
});
test('duplicate, empty, third selection and clear preserve the other pin and restore ordinary selection',()=>{
 const board=createPinboard();board.start();expect(board.capture(null)).toBe(false);board.capture(record('way/1'));
 expect(board.capture(record('way/1'))).toBe(false);board.capture(record('way/2'));
 expect(board.capture(spatialRecord(town,world,'person','p1'))).toBe(false);
 board.clear(0);expect(board.state().active).toBe(false);expect(board.state().pins[1].id).toBe('way/2');
 expect(board.capture(record('way/1'))).toBe(false);board.start();expect(board.capture(record('way/1'))).toBe(true);
 const state=board.state();state.pins[0].id='mutated';expect(board.state().pins[0].id).toBe('way/1');
});
test('matched field units keep zero and mark missing/nonfinite values unavailable',()=>{
 const result=comparisonRows(record('way/1'),record('way/2'));expect(result.rows).toEqual([
 {label:'Footprint area',unit:'m²',values:[0,40]}, {label:'Scene height (illustrative)',unit:'m',values:[12,null]}, {label:'Supplied levels',unit:'levels',values:[null,2]}]);
 expect(spatialRecord(town,world,'building','missing')).toBeNull();expect(spatialRecord(town,world,'journal','p1')).toBeNull();
 expect(comparisonRows(null,null).rows).toEqual([]);
});
test('incompatible types and authorities retain identities but do not invent matched fields',()=>{
 const a=record('way/1'),b=spatialRecord(town,world,'person','p1');expect(comparisonRows(a,b).limitation).toContain('Different entity types');
 expect(comparisonRows(a,{...a,authority:'population'}).rows).toEqual([]);
 expect(comparisonRows(b,{...b,id:'p2'}).rows[1].values).toEqual([0,0]);
});

import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
test('real seeded World checkpoints and subsequent events remain identical after comparison reads',()=>{
 const create=()=>{const town=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:16});return {town,world:createWorld(town,{runSeed:'469',recordHistory:true})};};
 const a=create(),b=create(),before=JSON.stringify(a.world.captureCheckpoint());
 const board=createPinboard();board.start();board.capture(spatialRecord(a.town,a.world,'building',a.town.buildings[0].id));board.capture(spatialRecord(a.town,a.world,'building',a.town.buildings[1].id));
 expect(JSON.stringify(a.world.captureCheckpoint())).toBe(before);
 expect(board.state().pins[0].runId).toBe(a.world.getActivitySnapshot().runId);
 a.world.step(20);b.world.step(20);
 expect(a.world.captureCheckpoint()).toEqual(b.world.captureCheckpoint());
});
