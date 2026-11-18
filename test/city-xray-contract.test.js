import { test, expect } from 'bun:test';
import { readFrame, frameHash, canonical } from '../world/city-xray/contract.js';
import { cityFixture } from '../world/city-xray/fixtures/city-v1.js';
const change=fn=>{const f=structuredClone(cityFixture());fn(f);return ()=>readFrame(f);};
test('fixed fixture replay, zero seed, stable source hash and resolvable IDs',async()=>{
 const a=cityFixture(0);expect(a.seed).toBe(0);expect(await frameHash(a)).toBe(await frameHash(cityFixture(0)));
 expect(await frameHash(a)).toBe('b059a741820f11e8fc22d8b26f0aad6fc29a629fd8a0c24313ef7a3481fa030e');
 expect(await frameHash(a)).not.toBe(await frameHash(cityFixture(1)));
 const ids=new Set([...a.intersections,...a.roads,...a.entities].map(r=>r.id));
 expect(a.samples.every(s=>ids.has(s.targetId))).toBe(true);
 expect(a.samples[0].value).toBe(0);expect(a.samples[1].value).toBe(null);
});
test('detached immutable source and canonical key ordering',()=>{
 const source=structuredClone(cityFixture());const before=canonical(source);const frame=readFrame(source);
 source.entities[0].position[0]=99;expect(frame.entities[0].position[0]).not.toBe(99);
 expect(()=>{frame.entities[0].position[0]=3;}).toThrow();
 const frozen=cityFixture();expect(canonical(readFrame(frozen))).toBe(before);
 expect(canonical({b:2,a:1})).toBe(canonical({a:1,b:2}));
});
const failures={
 'sparse position':f=>delete f.entities[0].position[0],
 'missing seed':f=>delete f.seed,'invalid seed':f=>f.seed=-1,'nonfinite':f=>f.samples[0].value=Infinity,
 'NaN coordinate':f=>f.entities[0].position[0]=NaN,'missing value':f=>delete f.samples[0].value,
 'oversized':f=>f.entities=Array(20001).fill(f.entities[0]),'cross run':f=>f.entities[0].runId='other',
 'units':f=>f.samples[0].units='residents','coordinate units':f=>f.coordinates.units='metres',
 'clock mismatch':f=>f.metrics[0].clock.unit='month','bad endpoint':f=>f.roads[0].intersectionIds[0]='absent',
 'bad path':f=>f.roads[0].path[0]=[1,2,3],'unresolved plot':f=>f.samples[0].targetId='absent',
 'duplicate':f=>f.entities[1].id=f.entities[0].id,'missing count':f=>f.metrics[0].missingCount=0,
 'represented fiction':f=>f.samples[0].representedCount=100,'budget':f=>f.display.symbolCount=20001,
 'schema':f=>f.schemaVersion='future','unsupported layer':f=>f.supportedLayers.push('vehicles'),
};
for(const [name,fn]of Object.entries(failures))test(`reject ${name}`,()=>expect(change(fn)).toThrow());
test('join requires exact authority/run/clock and source versions',()=>{
 const f=cityFixture();expect(()=>readFrame(cityFixture(1),{identity:f.identity})).toThrow();
 expect(()=>readFrame(f,{clock:{...f.clock,value:61}})).toThrow();
 expect(()=>readFrame(f,{coordinates:{...f.coordinates,units:'metres'}})).toThrow();
 expect(readFrame(f,{identity:f.identity,clock:f.clock})).toEqual(f);
});
test('missing is separate from measured zero; source cannot carry accessors',()=>{
 expect(change(f=>f.samples[0].value=null)).toThrow();
 const f=structuredClone(cityFixture());Object.defineProperty(f,'bad',{enumerable:true,get(){throw Error('must not execute');}});
 expect(()=>readFrame(f)).toThrow('accessor');
 expect(()=>cityFixture(null)).toThrow();expect(()=>cityFixture(NaN)).toThrow();
});

test('UTF-8 and total node budgets bound metadata before cloning',()=>{
 const unicode=structuredClone(cityFixture());unicode.metadata=Array(1400).fill('界'.repeat(3000));
 expect(canonical(unicode).length).toBeLessThan(12_000_000);
 expect(()=>readFrame(unicode)).toThrow('frame byte budget');
 const nodes=structuredClone(cityFixture());nodes.metadata=Array.from({length:2000},()=>Array(500).fill(null));
 expect(()=>readFrame(nodes)).toThrow('frame node budget');
});
test('holes cannot masquerade as JSON arrays using extra or hidden fields',()=>{
 const sparse=structuredClone(cityFixture());delete sparse.entities[0];sparse.entities.extra={};
 expect(()=>readFrame(sparse)).toThrow('dense arrays');
 const hidden=structuredClone(cityFixture());Object.defineProperty(hidden,'hidden',{value:'not JSON',enumerable:false});
 expect(()=>readFrame(hidden)).toThrow('enumerable JSON');
});
