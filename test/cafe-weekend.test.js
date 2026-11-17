import { test, expect } from 'bun:test';
import { startCafe, tradeCafe, cancelCafe, verifyCafe } from '../world/cafe/session.js';
const decision = { stock: 30, price: 2, staff: 1 };
test('executed matched-seed weekends succeed or fail without changing the parent', () => {
  const parent = startCafe(), before = JSON.stringify(parent);
  let win = parent, lose = parent;
  for (let i=0;i<2;i++) { win=tradeCafe(win,decision); lose=tradeCafe(lose,{...decision,stock:0}); }
  expect(win.status).toBe('success'); expect(lose.status).toBe('failure');
  expect(JSON.stringify(parent)).toBe(before); expect(Object.isFrozen(win.checkpoints[1].def)).toBe(true);
  expect(verifyCafe(JSON.parse(JSON.stringify(win))).status).toBe('verified');
  expect(win.source.seed).toBe(lose.source.seed);
  for (const r of win.receipts) {
    expect(Object.values(r.outcomes).reduce((a,b)=>a+b,0)).toBe(r.arrivals);
    expect(r.revenue-r.cogs-r.spoilageCost-r.rent-r.wages-r.marketingCost-r.interest).toBeCloseTo(r.profit);
    expect(r.employment.workerHours).toBe(8); expect(r.employment.wages).toBe(r.wages);
  }
  expect(()=>tradeCafe(win,decision)).toThrow();
});
test('cancel, missing source, unsupported levers and replay mismatch never award results', () => {
  const initial=startCafe(), one=tradeCafe(initial,decision), cancelled=cancelCafe(one);
  expect(cancelled.status).toBe('cancelled'); expect(cancelled.receipts).toEqual(one.receipts);
  expect(()=>tradeCafe(cancelled,decision)).toThrow(); expect(verifyCafe(cancelled).status).toBe('verified');
  expect(()=>startCafe(null)).toThrow('unavailable');
  expect(()=>tradeCafe(initial,{...decision,hours:4})).toThrow('unsupported');
  const broken=JSON.parse(JSON.stringify(one)); broken.checkpoints[1].cash++;
  expect(verifyCafe(broken).status).toBe('mismatch');
  expect(verifyCafe({}).status).toBe('mismatch');
  const missing=JSON.parse(JSON.stringify(one)); delete missing.source;
  expect(verifyCafe(missing).status).toBe('mismatch');
});
test('pinned authored fixture replays against independently recorded evidence', async () => {
  const fixture=await Bun.file(new URL('./fixtures/cafe/weekend-v1.json',import.meta.url)).json();
  expect(verifyCafe(fixture).status).toBe('verified');
  expect(fixture.status).toBe('success');
});
