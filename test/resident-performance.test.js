import {test,expect} from 'bun:test';
import {selectVisibleIndices} from '../world/population/visible-sample.js';
import {fullSort,heap,insertion,partition} from '../scripts/performance/selection-alternatives.js';
test('exact selectors match the previous full sort across ties, sizes and camera positions',()=>{
 let seed=42;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%41)-20;
 for(const n of [0,1,9,501,2048]){
  const people={age:new Uint8Array(n),x:Float32Array.from({length:n},random),z:Float32Array.from({length:n},random),activity:Uint8Array.from({length:n},()=>Math.abs(random())%9)};
  const before=structuredClone(people);
  for(const view of [{x:0,z:0},{x:20,z:-10}])for(const limit of [0,1,8,500,n+1]){
   const expected=fullSort(people,limit,view);
   for(const select of [selectVisibleIndices,heap,insertion,partition])expect(select(people,limit,view)).toEqual(expected);
  }
  expect(people).toEqual(before);
 }
});
