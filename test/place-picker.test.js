import {test,expect} from 'bun:test';
import {PLACES,placeURL} from '../world/place-picker.js';
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
test('every postcard has unique stable URL seed and valid geography; saved identity is cleared',()=>{
 expect(PLACES).toHaveLength(6);expect(new Set(PLACES.map(p=>p.seed)).size).toBe(6);
 for(const p of PLACES){const url=new URL(placeURL(p,'http://localhost/world?experiment=saved&run=old&renderer=canvas2d&people=99'));expect(url.searchParams.get('seed')).toBe(p.seed);expect(Number(url.searchParams.get('lat'))).toBe(p.lat);expect(url.searchParams.has('experiment')).toBe(false);expect(url.searchParams.has('run')).toBe(false);expect(url.searchParams.get('renderer')).toBe('canvas2d');}
});
test('coordinate boundary validation and deterministic custom seed',()=>{expect(()=>placeURL({lat:86,lng:0},'http://localhost')).toThrow();expect(()=>placeURL({lat:0,lng:NaN},'http://localhost')).toThrow();expect(placeURL({lat:0,lng:0},'http://localhost')).toContain('place-v1');});
test('postcard seed replays synthetic world and changes run authority',()=>{const p=PLACES[0],town=buildTown(p,{source:'none'},{maxPeople:10});const a=createWorld(town,{runSeed:p.seed}),b=createWorld(buildTown(p,{source:'none'},{maxPeople:10}),{runSeed:p.seed});expect(a.captureCheckpointRetention().transitCounterContext.runSeed).toBe(p.seed);expect(a.getActivitySnapshot().seed).toBe(p.seed);a.step(60);b.step(60);expect(a.summary()).toEqual(b.summary());expect(a.people.map(p=>p.needs)).toEqual(b.people.map(p=>p.needs));});
