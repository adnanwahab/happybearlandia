import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExperiment, applyEvent, replay, results, createExperimentHandler, participantCookie, cookieIdentity } from '../ops/release-experiments/system.js';
import { run } from '../ops/release-experiments/cli.js';

const spec = () => ({ id: 'release-203', seed: 'fixed-v1', candidateRevision: 'candidate-sha', controlRevision: 'baseline-sha',
  goNoGoEvidence: 'private SHE-67 report', selectionRationale: 'Invited staff volunteers', metric: 'completed normal journey',
  windowStart: '2026-11-12T00:00:00Z', windowEnd: '2026-11-13T00:00:00Z',
  entryPath: '/release-preview', candidatePath: '/world/future-machine.html', controlPath: '/world/',
  consentRequired: true, populationSize: 100, maxTreatment: 2, minPerArm: 2, regressionThreshold: 0.2,
  participants: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, ...(i < 4 ? { consentEvidence: 'private consent receipt' } : {}) })) });
const observe = (participantId, success) => ({ type: 'observe', observation: { participantId, success, observedAt: '2026-11-12T01:00:00Z', evidence: 'synthetic fixture outcome' } });
const decision = overrides => ({ type: 'decide', decision: { human: 'fixture operator', approvalEvidence: 'fixture signed approval reference', reason: 'fixture review', decidedAt: '2026-11-14T00:00:00Z', ...overrides } });
function measured(success = false) {
  let state = createExperiment(spec());
  for (const [id, arm] of Object.entries(state.assignments)) state = applyEvent(state, observe(id, arm === 'control' || success));
  return state;
}
test('assignment is stable, capped, consent-aware and independent of roster order', () => {
  const s = spec(); const state = createExperiment(s);
  s.participants.reverse();
  expect(createExperiment(s).assignments).toEqual(state.assignments);
  expect(state.assignments.p4).toBeUndefined();
  expect(Object.values(state.assignments).filter(a => a === 'treatment')).toHaveLength(2);
  for (const overrides of [{ consentRequired: undefined }, { maxTreatment: 11 }, { regressionThreshold: NaN }, { candidatePath: '//evil.test' }, { controlPath: '/release-preview' }, { minPerArm: 3 }]) expect(() => createExperiment({ ...spec(), ...overrides })).toThrow();
});
test('missing data blocks promotion; threshold is strictly greater; samples cannot be duplicated or invented', () => {
  const state = createExperiment(spec());
  expect(results(state).regression).toBeNull();
  expect(() => applyEvent(state, decision({ action: 'promote', goNoGoEvidence: 'report' }))).toThrow();
  expect(() => applyEvent(state, observe('p4', true))).toThrow();
  const id = Object.keys(state.assignments)[0];
  const next = applyEvent(state, observe(id, true));
  expect(() => applyEvent(next, observe(id, false))).toThrow();
  expect(() => applyEvent(state, { ...observe(id, true), observation: { ...observe(id, true).observation, observedAt: 'bad' } })).toThrow();
  const boundary = measured(); boundary.spec.regressionThreshold = 1;
  expect(results(boundary).breached).toBe(false);
});
test('regression proposes but does not execute rollback; exact human approval closes it', () => {
  const state = measured();
  expect(state.status).toBe('running');
  expect(state.proposal.evidence.regression).toBe(1);
  expect(() => applyEvent(state, decision({ action: 'promote', goNoGoEvidence: 'report' }))).toThrow();
  expect(() => applyEvent(state, decision({ action: 'rollback', proposalId: 'wrong' }))).toThrow();
  expect(() => applyEvent(state, decision({ action: 'rollback', proposalId: state.proposal.id, human: '' }))).toThrow();
  const next = applyEvent(state, decision({ action: 'rollback', proposalId: state.proposal.id }));
  expect(next.status).toBe('rolled-back');
  expect(state.proposal.status).toBe('pending');
  expect(() => applyEvent(next, observe('p0', true))).toThrow();
});
test('promotion requires human evidence and a completed observation window', () => {
  const state = measured(true);
  expect(() => applyEvent(state, decision({ action: 'promote', goNoGoEvidence: 'report', decidedAt: '2026-11-12T02:00:00Z' }))).toThrow();
  expect(applyEvent(state, decision({ action: 'promote', goNoGoEvidence: 'report' })).status).toBe('promoted');
});
test('private CLI persists replayable decisions and HTTP gate honors signed identity and rollback', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hbl-release-experiment-'));
  const file = join(root, 'history.json'); const input = join(root, 'input.json');
  const invoke = (command, payload) => { writeFileSync(input, JSON.stringify(payload)); return run(command, file, input); };
  const secret = 'synthetic-test-secret-32-characters-long';
  try {
    invoke('create', spec());
    expect(() => invoke('create', spec())).toThrow();
    const initial = run('status', file);
    const id = Object.keys(initial.assignments).find(id => initial.assignments[id] === 'treatment');
    const handler = createExperimentHandler({ file, identify: (req, experiment) => cookieIdentity(req, experiment, secret), now: () => Date.parse('2026-11-12T02:00:00Z') });
    const request = cookie => new Request('http://localhost/release-preview', { headers: cookie ? { cookie: `hbl_release=${cookie}` } : {} });
    const token = participantCookie(spec().id, id, secret);
    expect(handler(request(token)).headers.get('location')).toBe(spec().candidatePath);
    expect(handler(request(token + 'x')).headers.get('location')).toBe(spec().controlPath);
    expect(handler(request()).headers.get('location')).toBe(spec().controlPath);
    expect(cookieIdentity(request(token), 'different-release', secret)).toBeNull();
    expect(handler(new Request('http://localhost/api/health'))).toBeNull();
    for (const [pid, arm] of Object.entries(initial.assignments)) invoke('observe', observe(pid, arm === 'control').observation);
    const pending = run('status', file);
    expect(pending.proposal.status).toBe('pending');
    invoke('decide', decision({ action: 'rollback', proposalId: pending.proposal.id }).decision);
    expect(handler(request(token)).headers.get('location')).toBe(spec().controlPath);
    const events = JSON.parse(readFileSync(file));
    expect(replay(events).status).toBe('rolled-back');
    const before = readFileSync(file, 'utf8');
    expect(() => invoke('observe', observe(id, true).observation)).toThrow();
    expect(readFileSync(file, 'utf8')).toBe(before);
    writeFileSync(file, 'broken');
    expect(handler(request(token)).status).toBe(503);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test.skipIf(process.env.HBL_RELEASE_HTTP_TEST !== '1')('normal server entry reads private history and routes treatment/control over HTTP', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hbl-release-http-'));
  const file = join(root, 'history.json');
  const secret = 'synthetic-http-secret-32-characters-long';
  const s = spec();
  s.windowStart = new Date(Date.now() - 60000).toISOString();
  s.windowEnd = new Date(Date.now() + 60000).toISOString();
  writeFileSync(file, JSON.stringify([{ type: 'create', spec: s }]));
  const state = createExperiment(s);
  const id = Object.keys(state.assignments).find(id => state.assignments[id] === 'treatment');
  const child = Bun.spawn([process.execPath, '--no-env-file', 'server.js'], {
    env: { PATH: process.env.PATH, PORT: '0', HBL_WORLD_DB_PATH: join(root, 'world.sqlite'),
      DECISION_STORE_DIR: join(root, 'decision'), HBL_REALITY_SHARE_DB_PATH: join(root, 'shares.sqlite'),
      HBL_CITY_DATA_DIR: join(root, 'city'), HBL_JOURNAL_ROOT: join(root, 'journals'),
      HBL_RELEASE_EXPERIMENT_FILE: file, HBL_RELEASE_IDENTITY_SECRET: secret }, stdout: 'pipe', stderr: 'pipe',
  });
  try {
    const reader = child.stdout.getReader();
    let output = '';
    let startupTimer;
    const origin = await Promise.race([
      (async () => { while (true) { const chunk = await reader.read(); if (chunk.done) throw Error('Server exited before listening: ' + await new Response(child.stderr).text()); output += new TextDecoder().decode(chunk.value); const match = output.match(/running at (http:\/\/localhost:\d+)/); if (match) return match[1]; } })(),
      new Promise((_, reject) => startupTimer = setTimeout(() => reject(Error('Server startup timeout')), 8000)),
    ]).finally(() => clearTimeout(startupTimer));
    const control = await fetch(origin + s.entryPath, { redirect: 'manual' });
    expect(control.status).toBe(302); expect(control.headers.get('location')).toBe(s.controlPath);
    const treatment = await fetch(origin + s.entryPath, { redirect: 'manual', headers: { cookie: `hbl_release=${participantCookie(s.id, id, secret)}` } });
    expect(treatment.headers.get('location')).toBe(s.candidatePath);
    expect(treatment.headers.get('cache-control')).toContain('no-store');
    expect((await fetch(origin + '/api/health')).status).toBe(200);
    expect((await fetch(origin + s.controlPath)).status).toBe(200);
    expect((await fetch(origin + s.candidatePath)).status).toBe(200);
  } finally { child.kill(); await child.exited; rmSync(root, { recursive: true, force: true }); }
}, 12000);
