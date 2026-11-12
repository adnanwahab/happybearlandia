import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { inspectReleaseConfig, reviewRollbackRecord } from '../ops/release-operations-dry-run.js';

function completeRecord() {
  return {
    incidentId: 'fixture-incident', incidentCommander: 'fixture-commander', rollbackOperator: 'fixture-operator',
    humanApproval: 'fixture approval reference', previousConfig: '/private/fixture/fly.rollback.toml',
    backupEvidence: 'fixture backup checksum', restoreEvidence: 'fixture restore log',
    savedRecordEvidence: 'fixture selected records match', writeReconciliation: 'fixture no writes since backup',
    mountEvidence: 'fixture single hbl_data mount', stagingEvidence: 'fixture staging log',
    compatibilityEvidence: 'fixture schema check log', severity: 'SEV2', writesQuiesced: true,
    singleWriterConfirmed: true, oldImageReadsCurrentSchema: true, evidenceScope: 'approved-staging',
    previousImage: 'registry.fly.io/happybearlandia@sha256:' + 'a'.repeat(64), previousBuild: 'f1174eb',
    stagingOrigin: 'https://fixture-staging.invalid',
    stagingReady: { status: 'ready', buildId: 'f1174eb', checks: { worldStorage: 'ok', decisionStorage: 'ok' } },
  };
}

test('current repository topology retains mount and readiness while refusing canary assumptions', () => {
  const config = Bun.TOML.parse(readFileSync(new URL('../fly.toml', import.meta.url), 'utf8'));
  expect(inspectReleaseConfig(config)).toMatchObject({ problems: [], canaryAllowed: false, productionVerified: false });
  const changed = structuredClone(config);
  changed.mounts = [];
  changed.http_service.checks = [];
  expect(inspectReleaseConfig(changed).problems).toHaveLength(2);
});

test('complete synthetic record produces review-only argv and cannot execute a rollback', () => {
  const result = reviewRollbackRecord(completeRecord());
  expect(result.decision).toBe('RECORD_COMPLETE_FOR_HUMAN_REVIEW');
  expect(result.executed).toBe(false);
  expect(result.evidenceIndependentlyVerified).toBe(false);
  expect(result.proposedCommand).toContain('--ha=false');
  expect(result.proposedCommand.at(-1)).toBe('rolling');
});

test('missing evidence, local evidence and production-as-staging all fail closed', () => {
  expect(reviewRollbackRecord({}).decision).toBe('BLOCKED');
  for (const stagingOrigin of ['http://127.0.0.1:3000', 'https://happybearlandia.fly.dev', 'https://user:secret@stage.invalid']) {
    expect(reviewRollbackRecord({ ...completeRecord(), stagingOrigin }).proposedCommand).toBeNull();
  }
  expect(reviewRollbackRecord({ ...completeRecord(), evidenceScope: 'local' }).decision).toBe('BLOCKED');
});

test('storage failures, wrong build, mutable image and incompatible schema block image-only recovery', () => {
  for (const overrides of [
    { writesQuiesced: false }, { singleWriterConfirmed: false }, { oldImageReadsCurrentSchema: false },
    { previousImage: 'registry.fly.io/happybearlandia:latest' },
    { stagingReady: { status: 'ready', buildId: 'deadbee', checks: { worldStorage: 'ok', decisionStorage: 'ok' } } },
    { stagingReady: { status: 'ready', buildId: 'f1174eb', checks: { worldStorage: 'unavailable', decisionStorage: 'ok' } } },
    { humanApproval: '' },
  ]) expect(reviewRollbackRecord({ ...completeRecord(), ...overrides }).proposedCommand).toBeNull();
});

test('CLI rejects an execution request and leaves repository config unchanged', () => {
  const before = readFileSync(new URL('../fly.toml', import.meta.url), 'utf8');
  const result = Bun.spawnSync([process.execPath, '--no-env-file', 'ops/release-operations-dry-run.js', '--execute'], {
    env: { PATH: process.env.PATH }, cwd: new URL('..', import.meta.url).pathname,
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('No execution mode exists');
  expect(readFileSync(new URL('../fly.toml', import.meta.url), 'utf8')).toBe(before);
});

test('malformed incident records are rejected without treating them as complete', () => {
  for (const record of [null, [], 'not a record']) {
    expect(() => reviewRollbackRecord(record)).toThrow('Expected an incident record object');
  }
});
