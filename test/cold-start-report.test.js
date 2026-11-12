import { test, expect } from 'bun:test';
import { buildReport, metric, observeStartup } from '../scripts/benchmark-cold-start.mjs';

test('navigation-relative timestamps are preserved, not rebased to module startup', () => {
  const report = buildReport({ timing: { appReadyMs: 900, firstUsefulRenderMs: 750.5, firstActionableControlMs: 920 }, selectedBackend: 'canvas2d' });
  expect(report.schemaVersion).toBe('hbl-cold-start.v1');
  expect(report.timing).toEqual({ appReadyMs: 900, firstUsefulRenderMs: 750.5, firstActionableControlMs: 920 });
  expect(report.selectedBackend).toBe('canvas2d');
});
test('missing, negative and non-finite metrics remain unavailable, never zero success', () => {
  for (const value of [undefined, null, -1, NaN, Infinity, '12']) expect(metric(value)).toBeNull();
  expect(metric(0)).toBe(0);
  const report = buildReport();
  expect(Object.values(report.timing)).toEqual([null, null, null]);
  expect(report.memory.usedJSHeapBytes).toBeNull();
  expect(report.selectedBackend).toBeNull();
});
test('error and fallback evidence survives normalization', () => {
  const report = buildReport({ requestedBackend: 'webgl', selectedBackend: 'canvas2d', errors: ['timeout'], memory: { usedJSHeapBytes: 1234 }, startup: { graphicsFallback: 'GPU unavailable' } });
  expect(report.errors).toEqual(['timeout']);
  expect(report.memory.usedJSHeapBytes).toBe(1234);
  expect(report.startup.graphicsFallback).toBe('GPU unavailable');
});
test('observer waits for useful geometry and an unobscured enabled control', () => {
  const saved = { window: globalThis.window, document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, getComputedStyle: globalThis.getComputedStyle };
  let queue = [], hit = null;
  const control = { disabled: true, getAttribute: () => null, getBoundingClientRect: () => ({ x: 0, y: 0, width: 10, height: 10 }), contains: () => false };
  try {
    globalThis.window = { hblWorldStartup: { firstFrameMs: 10 } };
    globalThis.document = { querySelector: () => control, elementFromPoint: () => hit };
    globalThis.getComputedStyle = () => ({ visibility: 'visible' });
    globalThis.requestAnimationFrame = callback => queue.push(callback);
    const frame = () => { const pending = queue; queue = []; pending.forEach(callback => callback()); };
    observeStartup(); frame();
    expect(window.__hblColdStart.timing).toEqual({});
    Object.assign(window.hblWorldStartup, { placeholdersReadyMs: 20, readyMs: 30 });
    frame(); frame();
    expect(window.__hblColdStart.timing.firstUsefulRenderMs).toBeNumber();
    expect(window.__hblColdStart.timing.firstActionableControlMs).toBeUndefined();
    control.disabled = false; frame();
    expect(window.__hblColdStart.timing.firstActionableControlMs).toBeUndefined();
    hit = control; frame();
    expect(window.__hblColdStart.timing.firstActionableControlMs).toBeNumber();
  } finally { Object.assign(globalThis, saved); }
});
