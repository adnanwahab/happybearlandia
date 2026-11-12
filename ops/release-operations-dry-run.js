// Offline release-record review only: this module never spawns commands or sends requests.
import { readFileSync } from 'node:fs';

export function inspectReleaseConfig(config) {
  const problems = [];
  if (config.app !== 'happybearlandia') problems.push('Unexpected production app; review topology manually.');
  if (!config.mounts?.some(m => m.source === 'hbl_data' && m.destination === '/data')) problems.push('Expected hbl_data mount at /data is missing.');
  if (config.env?.HBL_WORLD_DB_PATH !== '/data/world-experiments.sqlite') problems.push('World database path changed.');
  if (config.env?.DECISION_STORE_DIR !== '/data/decision-experiments') problems.push('Decision storage path changed.');
  if (!config.http_service?.checks?.some(c => c.path === '/api/ready')) problems.push('Readiness check is missing.');
  return { scope: 'repository-config-only', app: config.app, problems, singleWriterRequired: true,
    canaryAllowed: false, productionVerified: false };
}

// Assertions are operator-provided evidence references, never proof from this dry run.
export function reviewRollbackRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw Error('Expected an incident record object.');
  const blockers = [];
  const required = ['incidentId', 'incidentCommander', 'rollbackOperator', 'humanApproval',
    'previousConfig', 'backupEvidence', 'restoreEvidence', 'savedRecordEvidence',
    'writeReconciliation', 'mountEvidence', 'stagingEvidence', 'compatibilityEvidence'];
  for (const key of required) {
    if (typeof record[key] !== 'string' || !record[key].trim()) blockers.push(`Missing ${key}.`);
  }
  const digest = /^registry\.fly\.io\/happybearlandia@sha256:[a-f0-9]{64}$/;
  if (!digest.test(record.previousImage || '')) blockers.push('previousImage must be the recorded immutable production image digest.');
  if (!/^[a-f0-9]{7,64}$/.test(record.previousBuild || '')) blockers.push('Missing valid previousBuild.');
  if (!['SEV1', 'SEV2', 'SEV3'].includes(record.severity)) blockers.push('Unknown severity.');
  if (record.writesQuiesced !== true) blockers.push('Affected writes are not confirmed quiesced.');
  if (record.singleWriterConfirmed !== true) blockers.push('Single writer is not confirmed.');
  if (record.oldImageReadsCurrentSchema !== true) blockers.push('Old image compatibility is unverified or failed: use the authorized data-recovery branch, not image-only rollback.');
  if (record.evidenceScope !== 'approved-staging') blockers.push('Local/unspecified evidence cannot establish approved staging verification.');
  let origin;
  try {
    origin = new URL(record.stagingOrigin);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
        ['happybearlandia.fly.dev', 'localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw Error();
  } catch { blockers.push('Provide a distinct approved HTTPS staging origin without credentials.'); }
  const ready = record.stagingReady;
  if (ready?.status !== 'ready' || ready?.buildId !== record.previousBuild ||
      ready?.checks?.worldStorage !== 'ok' || ready?.checks?.decisionStorage !== 'ok') {
    blockers.push('Staging readiness must match the previous build and both required storage checks.');
  }
  return {
    mode: 'dry-run', executed: false, evidenceIndependentlyVerified: false,
    decision: blockers.length ? 'BLOCKED' : 'RECORD_COMPLETE_FOR_HUMAN_REVIEW', blockers,
    // An empty blocker list never authorizes execution. Operator rechecks actual evidence.
    proposedCommand: blockers.length ? null : ['flyctl', 'deploy', '--app', 'happybearlandia',
      '--config', record.previousConfig, '--image', record.previousImage, '--ha=false', '--strategy', 'rolling'],
  };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      const report = inspectReleaseConfig(Bun.TOML.parse(readFileSync(new URL('../fly.toml', import.meta.url), 'utf8')));
      console.log(JSON.stringify(report, null, 2));
      if (report.problems.length) process.exitCode = 1;
    } else if (args.length === 2 && args[0] === '--record') {
      const result = reviewRollbackRecord(JSON.parse(readFileSync(args[1], 'utf8')));
      console.log(JSON.stringify(result, null, 2));
      if (result.blockers.length) process.exitCode = 1;
    } else {
      throw Error('Usage: bun ops/release-operations-dry-run.js [--record <private-record.json>]. No execution mode exists.');
    }
  } catch (error) {
    console.error('Dry-run review failed:', error.message);
    process.exitCode = 1;
  }
}
