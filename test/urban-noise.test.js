import {test,expect} from 'bun:test';
import {FIXTURE,proximity} from '../world/noise/model.js';
test('versioned authored fixture has deterministic geometric falloff without mutating input',()=>{
 const before=JSON.stringify(FIXTURE);
 expect(proximity({x:0,z:0})).toEqual({distance:0,strength:1});
 expect(proximity({x:-100,z:40})).toEqual({distance:40,strength:.5});
 expect(proximity({x:-100,z:80}).strength).toBe(.2);
 expect(proximity({x:-100,z:800}).strength).toBe(0);
 expect(proximity({x:300,z:0}).distance).toBe(100);
 expect(proximity({x:-100,z:40})).toEqual(proximity({x:-100,z:40}));
 expect(JSON.stringify(FIXTURE)).toBe(before);
});
test('unknown and missing data remain missing, degenerate segments are points',()=>{
 for(const listener of [undefined,{}, {x:NaN,z:0},{x:0,z:Infinity}])expect(proximity(listener)).toBeNull();
 for(const segments of [[],[null],[{ax:0,az:0,bx:NaN,bz:0}]])expect(proximity({x:0,z:0},{version:'urban-noise.v1',segments})).toBeNull();
 expect(proximity({x:0,z:0},{...FIXTURE,version:'future'})).toBeNull();
 expect(proximity({x:3,z:4},{version:'urban-noise.v1',segments:[{ax:0,az:0,bx:0,bz:0}]})).toEqual({distance:5,strength:1/(1+(5/40)**2)});
});
