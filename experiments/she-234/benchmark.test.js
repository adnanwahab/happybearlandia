import {test,expect} from 'bun:test';
import {runCase} from './benchmark.mjs';
test('checkpoint branch preserves complete replay suffix, traces and parent',()=>{
  const result=runCase(42);
  expect(result.suffixEqual).toBe(true);
  expect(result.parentUnchanged).toBe(true);
  expect(result.A.steps).toBe(24);
  expect(result.B.steps).toBe(12);
  expect(result.changed).toBe(true);
  expect(result.C.naiveUnitsOnlyMatches).toBe(false);
  expect(runCase(42).targetDigest).toBe(result.targetDigest);
});
