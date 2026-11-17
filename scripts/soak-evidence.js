// bun scripts/soak-evidence.js report.json
// Offline evidence review only; does not execute or simulate a device soak.
import { readFile } from 'node:fs/promises';

export function reviewSoak(report) {
  const errors = [];
  const need = (ok, path) => { if (!ok) errors.push(path); };
  const finite = value => Number.isFinite(value) && value >= 0;
  const text = value => typeof value === 'string' && value.trim().length > 0;
  need(report?.schemaVersion === 1, 'schemaVersion must be 1');
  need(['T1', 'T2', 'T3', 'T4'].includes(report?.tier), 'tier');
  for (const key of ['device', 'os', 'browser', 'capturedAt', 'sourceCommit', 'modelVersion', 'rulesVersion', 'scenario', 'fallback']) {
    need(text(report?.[key]), key);
  }
  need(Number.isInteger(report?.seed) && report.seed >= 0 && report.seed <= 0xffffffff, 'seed');
  need(Number.isSafeInteger(report?.population) && report.population > 0, 'population');
  need(typeof report?.webgpuAvailable === 'boolean', 'webgpuAvailable');
  need(Array.isArray(report?.runs) && report.runs.length === 2, 'two runs required');
  const outcomes = [];
  for (const rendering of ['off', 'on']) {
    const runs = Array.isArray(report?.runs) ? report.runs.filter(run => run?.rendering === rendering) : [];
    need(runs.length === 1, `${rendering}: exactly one run`);
    const run = runs[0];
    if (!run) continue;
    const prefix = `${rendering}: `;
    need(run.workerSimulation === true, prefix + 'workerSimulation');
    need(text(run.evidence), prefix + 'evidence reference');
    need(typeof run.oom === 'boolean', prefix + 'oom observation');
    for (const key of ['crashes', 'reloads']) need(Number.isSafeInteger(run[key]) && run[key] >= 0, prefix + key);
    need(Array.isArray(run.minutes) && run.minutes.length === 20, prefix + '20 minute observations');
    for (let i = 0; i < 20; i++) {
      const m = run.minutes?.[i];
      need(m?.minute === i + 1 && finite(m?.modeledDays) && finite(m?.wallSeconds) && m.wallSeconds >= 60,
        prefix + `minute ${i + 1} throughput`);
    }
    // Unavailable browser APIs must be explicit, with a reason, never replaced by zero.
    for (const key of ['frameP50Ms', 'frameP95Ms', 'memoryHighWaterBytes', 'longTasks', 'batteryDropPercentagePoints']) {
      const metric = run[key];
      need(metric && (finite(metric.value) || (metric.value === null && text(metric.unavailableReason))), prefix + key);
    }
    if (finite(run.frameP50Ms?.value) && finite(run.frameP95Ms?.value)) {
      need(run.frameP50Ms.value <= run.frameP95Ms.value, prefix + 'frame percentile ordering');
    }
    const bg = run.background;
    need(bg && finite(bg.hiddenAtSeconds) && finite(bg.restoredAtSeconds) && bg.restoredAtSeconds > bg.hiddenAtSeconds &&
      text(bg.behavior) && text(bg.evidence), prefix + 'background/restore observation');
    const first = run.minutes?.[0], last = run.minutes?.[19];
    const baseline = first?.modeledDays / first?.wallSeconds;
    const retention = baseline > 0 ? (last?.modeledDays / last?.wallSeconds) / baseline : null;
    outcomes.push({ rendering, retention: Number.isFinite(retention) ? retention : null,
      proposedGate: report.tier === 'T2'
        ? (Number.isFinite(retention) ? (retention >= 0.8 ? 'pass' : 'fail') : 'unavailable')
        : ['T3', 'T4'].includes(report.tier) ? (run.oom === false ? 'pass' : 'fail') : 'not-defined' });
  }
  return { schemaVersion: 1, valid: errors.length === 0, errors,
    outcomes: errors.length ? [] : outcomes,
    gateStatus: 'proposed; requires SHE-177 ratification',
    limitation: 'Checks evidence structure, not authenticity, hardware eligibility, or completeness of the tier matrix.' };
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: bun scripts/soak-evidence.js report.json');
    const result = reviewSoak(JSON.parse(await readFile(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid || result.outcomes.some(o => o.proposedGate === 'fail' || o.proposedGate === 'unavailable')) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
