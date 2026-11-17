import { test, expect } from 'bun:test';
import { workload, oracle, measure } from '../world/gpu-reproducibility.js';
test('CPU oracle resolves collision, totals, minimum contact, and empty buckets',()=>{
  expect(oracle({buckets:3,records:[[0,31,9],[0,2,1],[1,1,0]]})).toEqual([2,33,1,1,1,0,0,0,0xffffffff]);
});
test('seeded generation is repeatable and bounded',()=>{
  expect(workload(42)).toEqual(workload(42)); expect(workload(42)).not.toEqual(workload(43));
  for(const args of [[-1],[0,0],[0,4097],[0,1,0],[0,1,257]]) expect(()=>workload(...args)).toThrow();
  const input=workload(0,4096,1), result=oracle(input);
  expect(result[0]).toBe(4096); expect(result[1]).toBeLessThan(4096*32); expect(result[2]).toBe(0);
});
test('100 runs for each CPU seed reproduce exact hashes',async()=>{
  for(const seed of [0,42,2911]) { const input=workload(seed); const row=await measure(input,'cpu',()=>oracle(input)); expect(row.accepted).toBe(true); expect(Object.values(row.hashes)).toEqual([100]); }
});
test('repeatability alone cannot pass an incorrect backend',async()=>{
  const input=workload(42); const row=await measure(input,'broken',()=>oracle(input).map(x=>x+1)); expect(row.accepted).toBe(false); expect(row.mismatches).toBe(100);
});
test('detects occasional divergence and rejects insufficient repeats',async()=>{
  const input=workload(42); let i=0;
  const row=await measure(input,'unstable',()=>{ const result=oracle(input); if(i++===99) result[0]++; return result; });
  expect(row.mismatches).toBe(1); expect(row.accepted).toBe(false);
  expect(measure(input,'cpu',()=>oracle(input),99)).rejects.toThrow();
});
