// bun ops/check-million-release.js <receipt.json>
export function checkMillionRelease(e = {}) {
  const failures = [];
  const require = (ok, name) => { if (!ok) failures.push(name); };
  const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const count = n => Number.isSafeInteger(n) && n >= 0;
  const named = s => typeof s === 'string' && s.trim().length > 0;
  require(e?.schema === 'hbl.million-release.v1', 'schema');
  for (const k of ['candidate','runId','modelVersion','rulesVersion','sourceVersion','scenario','device','os','browser','artifact','author']) require(named(e?.[k]), `provenance.${k}`);
  require(count(e?.seed) && e.seed <= 0xffffffff, 'provenance.seed');
  const c = e?.counts ?? {};
  require(finite(c.weightedResidents), 'counts.weightedResidents');
  for (const k of ['explicitAgents','updatedAgents','interactions','graphicalInstances']) require(count(c[k]), `counts.${k}`);
  require(c.explicitAgents >= 1e6 && c.updatedAgents >= 1e6 && c.updatedAgents <= c.explicitAgents, 'million distinct updated agents');
  require(finite(e?.windowSeconds) && e.windowSeconds >= 1200, '20 minute soak');
  const rate = count(c.interactions) && finite(e?.windowSeconds) && e.windowSeconds > 0 ? c.interactions / e.windowSeconds : null;
  require(Number.isFinite(rate) && rate >= 1e6, 'interactions per second');
  const m = e?.memory ?? {};
  require(finite(m.installedBytes) && m.installedBytes > 0 && finite(m.peakUsedBytes) && m.peakUsedBytes > 0 && m.peakUsedBytes <= m.installedBytes * .8 && m.swapGrowthBytes === 0 && m.incidents === 0, 'full-device memory');
  const rows = Array.isArray(e?.matrix) ? e.matrix : [];
  require(rows.length > 0, 'supported device/browser matrix');
  rows.forEach((r, i) => {
    require(named(r?.device) && named(r?.browser) && named(r?.artifact), `matrix.${i}.provenance`);
    require(count(r?.trials) && r.trials >= 20 && finite(r?.firstPlayP95Ms) && r.firstPlayP95Ms > 0 && r.firstPlayP95Ms <= 10000, `matrix.${i}.first play`);
    for (const k of ['noWebGPU','deviceLoss','workerFailure','memoryPressure','missingAssets','unsupportedReplay']) require(r?.fallbacks?.[k] === true, `matrix.${i}.fallback.${k}`);
  });
  const v = e?.correctness;
  require(v?.invariantViolations === 0 && v?.missingEvents === 0 && v?.replayPassed === true && v?.matchedSeedsPassed === true, 'model correctness');
  const r = e?.review;
  require(named(r?.reviewer) && r.reviewer !== e?.author && named(r?.operator) && r?.approved === true && r?.operatorApproved === true && r?.blockingFindings === 0 && named(e?.candidate) && r?.candidate === e.candidate && named(e?.runId) && r?.runId === e.runId, 'independent review and operator approval');
  return { policy: 'hbl.million-release.v1', status: failures.length ? 'HOLD' : 'PASS', candidate: e?.candidate ?? null, runId: e?.runId ?? null,
    counts: Object.fromEntries(['weightedResidents','explicitAgents','updatedAgents','graphicalInstances'].map(k => [k, c[k] ?? null])), interactionsPerSecond: rate, failures };
}
if (import.meta.main) {
  let report;
  try { report = checkMillionRelease(await Bun.file(process.argv[2]).json()); }
  catch { report = { status: 'HOLD', failures: ['Unreadable or invalid evidence JSON'] }; }
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}
