import {test,expect} from 'bun:test';
import {neighborhoodImpact} from '../world/what-if/impact.js';
import {compareNeighborhood} from '../world/what-if/model.js';
const person=(id,district,a,b)=>({id,before:{id,districtId:district,district,access:a},after:{id,access:b},delta:{access:999}});
const receipt=residents=>({version:'neighborhood-what-if.v1',residents});
test('rank actual paired differences with stable ties, zero rows, and explicit exclusions',()=>{
 const r=receipt([person('p2','b',0,.5),person('p1','a',.5,0),person('p3','a',null,1),person('p4','c',NaN,1),person('p5','d',0,0)]);
 const result=neighborhoodImpact(r,'access');
 expect(result.rows.map(r=>r.id)).toEqual(['a','b','d']);expect(result.rows[0].delta).toBe(-50);
 expect(result.rows[0].excluded).toBe(1);expect(result.excluded[0].id).toBe('c');expect(result.excluded[0].delta).toBeNull();
 expect(neighborhoodImpact(receipt([...r.residents].reverse()),'access')).toEqual(result);
 expect(()=>neighborhoodImpact(r,'welfare')).toThrow('Unsupported');
 expect(()=>neighborhoodImpact(receipt([r.residents[0],r.residents[0]]),'access')).toThrow('Unique');
});
test('missing identities and measurements never enter a ranking',()=>{
 const a=person('p1','a',0,1);a.after.id='other';
 const b=person('p2','b',0,Infinity);const c=person('p3','',0,1);
 const result=neighborhoodImpact(receipt([a,b,c]),'access');
 expect(result.rows).toEqual([]);expect(result.excluded).toHaveLength(2);expect(result.unmapped).toBe(1);
});
test('real paired model receipts reproduce identical metric rows without mutation',async()=>{
 const input={context:{bounds:{minX:-500,maxX:500,minZ:-500,maxZ:500},districts:[{id:'west',label:'West',x:-200,z:0},{id:'east',label:'East',x:200,z:0}],buildings:[]},project:{kind:'park',x:-200,z:0},config:{population:20,seed:42}};
 const a=await compareNeighborhood(input),b=await compareNeighborhood(input),copy=structuredClone(a);
 for(const metric of ['access','burden','commute']){expect(neighborhoodImpact(a,metric)).toEqual(neighborhoodImpact(b,metric));expect(neighborhoodImpact(JSON.parse(JSON.stringify(a)),metric)).toEqual(neighborhoodImpact(a,metric));}
 expect(a).toEqual(copy);
},30000);
