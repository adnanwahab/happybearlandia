import { test, expect } from 'bun:test';
import { scenario, stepCPU } from '../world/microagents/model.js';
test('10k replay, bounded state and population, immutable source',()=>{
 const a=scenario(),b=scenario();
 let x=a.energy,y=b.energy;
 for(let t=0;t<4;t++) {
  const r=stepCPU(a,x),q=stepCPU(b,y);
  expect(r).toEqual(q);expect(r.energy.length).toBe(10000);
  expect(r.energy.every((v,i)=>v<1024 && v!==x[i])).toBe(true);
  expect(r.contacts.every(v=>v<=8)).toBe(true);x=r.energy;y=q.energy;
 }
 expect(a.energy).toEqual(scenario().energy);
});
test('independent brute force oracle for spatial lookup and stable ID selection',()=>{
 const s=scenario({count:93,seed:0xffffffff,cap:3}),r=stepCPU(s);
 for(let i=0;i<s.count;i++) {
  const ids=Array.from({length:s.count},(_,j)=>j).filter(j=>j!==i && s.x[i]===s.x[j] && s.y[i]===s.y[j]).slice(0,s.cap);
  expect(r.contacts[i]).toBe(ids.length);
  expect(r.energy[i]).toBe((s.energy[i]+1+ids.reduce((n,j)=>n+s.energy[j],0)%7)%1024);
 }
});
test('single row, cap zero, wrap and invalid scenarios',()=>{
 const s=scenario({count:1,seed:0});s.energy[0]=1023;
 expect([...stepCPU(s).energy]).toEqual([0]);expect([...stepCPU(s).contacts]).toEqual([0]);
 expect(stepCPU(scenario({count:50,cap:0})).contacts.every(v=>v===0)).toBe(true);
 for(const input of [{count:0},{count:1000001},{seed:-1},{cap:33},{count:NaN}]) expect(()=>scenario(input)).toThrow();
});
