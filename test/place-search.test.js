import {test,expect} from 'bun:test';
import {searchPlaces,confirmedPlacePose} from '../world/place-search.js';
const building=(id,name='Library')=>({id,name,address:{label:'12 Main Street'},kind:'civic',center:[0,0],height:20,poly:[[-10,-10],[10,-10],[10,10],[-10,10]]});
test('exact ranking, duplicates, address and unsupported searches retain actual identities',()=>{
 const buildings=[building('w2'),building('w1'),building('w3','Library Annex')],before=JSON.stringify(buildings);
 expect(searchPlaces(buildings,' library ').map(b=>b.id)).toEqual(['w1','w2','w3']);
 expect(searchPlaces(buildings,'12 MAIN STREET')).toHaveLength(3);
 expect(searchPlaces(buildings,'999 Imaginary Road')).toEqual([]);expect(searchPlaces(buildings,'')).toEqual([]);
 expect(JSON.stringify(buildings)).toBe(before);
});
test('confirmation rechecks loaded identity, coordinates and collision failure',()=>{
 const buildings=[building('w1')],preview=searchPlaces(buildings,'Library')[0];
 expect(confirmedPlacePose(buildings,preview).position.y).toBeGreaterThan(23);
 expect(confirmedPlacePose([],preview)).toBeNull();
 expect(confirmedPlacePose([{...buildings[0],center:[20,0]}],preview)).toBeNull();
 const wall={...building('wall'),height:1600,poly:[[-1000,-1000],[1000,-1000],[1000,1000],[-1000,1000]]};
 expect(confirmedPlacePose([...buildings,wall],preview)).toBeNull();
});
test('malformed positions are unsupported and result count is bounded',()=>{
 expect(searchPlaces([{...building('bad'),center:[NaN,1]}],'Library')).toEqual([]);
 expect(searchPlaces(Array.from({length:50},(_,i)=>building(String(i))),'Library')).toHaveLength(30);
});
