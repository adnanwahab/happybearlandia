import {test,expect} from 'bun:test';
import fixture from './fixtures/shadow-atlas.json';
import {atlasGeometry,visualSun} from '../world/render/shadow-atlas/model.js';
import {simulationLighting} from '../world/render/environment/sim-lighting.js';
test('deterministic wall extrusion opposes sun and preserves source IDs',()=>{
 const rows=atlasGeometry(fixture.buildings,{x:1,y:1,z:0});
 expect(rows[1].shadows[0]).toEqual([[-10,0],[0,0],[0,10],[-10,10]]);
 expect(rows[1].id).toBe('synthetic:building');expect(rows[0].shadows).toEqual([]);
 expect(atlasGeometry(fixture.buildings,{x:1,y:1,z:0})).toEqual(rows);
});
test('sun reversal, night and missing geometry/height remain truthful',()=>{
 expect(atlasGeometry(fixture.buildings,{x:-1,y:1,z:0})[1].shadows[0][0]).toEqual([10,0]);
 expect(atlasGeometry(fixture.buildings,{x:1,y:-1,z:0})[1].shadows).toEqual([]);
 expect(atlasGeometry()).toEqual([]);
 expect(atlasGeometry([{poly:[[0,0],[1,0],[0,1]]}],{x:1,y:2,z:0})[0].shadows).toEqual([]);
 expect(atlasGeometry([{poly:[[NaN,0],[1,0],[0,1]]}],{})).toEqual([]);
});
test('World visual trajectory drives atlas direction without RNG',()=>{
 const morning=visualSun(simulationLighting(0,9).angle),evening=visualSun(simulationLighting(0,17).angle);
 expect(morning.x).toBeGreaterThan(0);expect(evening.x).toBeLessThan(0);
 expect(atlasGeometry(fixture.buildings,morning)[1].shadows.length).toBe(5);
});
