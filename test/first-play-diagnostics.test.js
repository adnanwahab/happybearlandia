import {test, expect} from 'bun:test';
import {createDiagnosticBundle, newTraceId, APP_VERSION} from '../world/future-machine/diagnostics.js';

import fixture from './fixtures/first-play-diagnostic.json';

const traceId = 'hbl-0123456789abcdef0123456789abcdef';
test('mock failure produces an exact reproducible artifact', () => {
  expect(createDiagnosticBundle({renderer:'canvas2d', errorType:'comparison-failure', traceId})).toEqual(fixture);
  expect(JSON.stringify(createDiagnosticBundle({renderer:'canvas2d', errorType:'comparison-failure', traceId}), null, 2)).toBe(JSON.stringify({
    schemaVersion:'hbl.first-play-diagnostic.v1', appVersion:APP_VERSION,
    renderer:'canvas2d', errorType:'comparison-failure', traceId,
  }, null, 2));
});
test('rejects sensitive values and excludes all extra context', () => {
  const secret = 'Bearer token alice@example.com 192.168.1.1 2001:db8::1 my typed proposal';
  const report = createDiagnosticBundle({renderer:secret, errorType:secret, traceId:secret,
    appVersion:secret, message:secret, stack:secret, url:secret, input:secret, token:secret});
  expect(report).toEqual({schemaVersion:'hbl.first-play-diagnostic.v1', appVersion:APP_VERSION,
    renderer:'unknown', errorType:'unknown', traceId:'unavailable'});
  expect(Object.isFrozen(report)).toBe(true);
});
test('only closed renderer and failure categories survive', () => {
  for (const renderer of ['webgpu','webgl','canvas2d','inventory-fallback'])
    expect(createDiagnosticBundle({renderer}).renderer).toBe(renderer);
  for (const errorType of ['boot-failure','comparison-failure','invalid-share'])
    expect(createDiagnosticBundle({errorType}).errorType).toBe(errorType);
  expect(createDiagnosticBundle().traceId).toBe('unavailable');
});
test('trace IDs are random local identifiers', () => {
  const a = newTraceId(), b = newTraceId();
  expect(a).toMatch(/^hbl-[0-9a-f]{32}$/); expect(a).not.toBe(b);
});

test('trace ID objects cannot smuggle serialized sensitive properties', () => {
  const traceId = {toString:()=> 'hbl-0123456789abcdef0123456789abcdef', token:'private'};
  expect(createDiagnosticBundle({traceId}).traceId).toBe('unavailable');
});
