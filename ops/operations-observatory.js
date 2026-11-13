import { open } from 'node:fs/promises';

export const ISSUE = 'https://linear.app/shel-bernstein/issue/SHE-202/build-the-operations-observatory';
const LIMIT = 1024 * 1024;
const MAX_AGE = 15 * 60 * 1000;
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const label = value => typeof value === 'string' ? value.slice(0, 300) : '';
export function source(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (url.hostname === 'linear.app' && /^\/[^/]+\/issue\/[^/]+(?:\/[^/]+)?\/?$/.test(url.pathname)) return url.href;
    if (url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/(?:actions\/runs\/\d+(?:\/job\/\d+)?|pull\/\d+)\/?$/.test(url.pathname)) return url.href;
  } catch {}
  return null;
}
function stamp(value, now) {
  const at = typeof value === 'string' ? Date.parse(value) : NaN;
  return { observedAt: Number.isFinite(at) ? new Date(at).toISOString() : null,
    freshness: !Number.isFinite(at) || at > now + 60000 ? 'unavailable' : now - at > MAX_AGE ? 'stale' : 'fresh' };
}
function panel(raw, now) {
  const url = source(raw?.source);
  return { ...stamp(raw?.observedAt, now), source: url || ISSUE,
    available: Boolean(url) && stamp(raw?.observedAt, now).freshness !== 'unavailable' };
}
export function projectObservatory(evidence, coordinator, now = Date.now()) {
  const data = evidence?.version === 1 ? evidence : {};
  const queue = { ...panel(null, now), total: null, eligible: null, held: null, tasks: [] };
  if (coordinator && number(coordinator.scannedAt) !== null && coordinator.scannedAt < 8640000000000 && Array.isArray(coordinator.issues)) {
    const rows = coordinator.issues.filter(row => row && typeof row === 'object');
    Object.assign(queue, panel({ observedAt: new Date(coordinator.scannedAt * 1000).toISOString(), source: 'https://linear.app/shel-bernstein/issue/SHE-180/hbl-ops-implement-safe-symphony-backlog-coordinator' }, now));
    queue.total = rows.length;
    queue.eligible = rows.filter(row => row.eligible === true && Array.isArray(row.reasons) && !row.reasons.length).length;
    queue.held = rows.filter(row => Array.isArray(row.reasons) && row.reasons.length).length;
    queue.tasks = rows.filter(row => /^SHE-[1-9]\d*$/.test(row.identifier) && Array.isArray(row.reasons) && row.reasons.length).map(row => ({
      id: row.identifier, reasons: row.reasons.map(label), source: `https://linear.app/shel-bernstein/issue/${row.identifier}`,
    }));
  }
  const symphony = { ...panel(data.symphony, now) };
  for (const key of ['running', 'retrying', 'blocked', 'capacity']) symphony[key] = symphony.available ? count(data.symphony[key]) : null;
  const ci = { ...panel(data.ci, now), runs: [] };
  if (ci.available && Array.isArray(data.ci.runs)) ci.runs = data.ci.runs.filter(run => run && source(run.source) && ['success', 'failure', 'pending', 'cancelled'].includes(run.status)).map(run => ({ name: label(run.name), status: run.status, source: source(run.source) }));
  const costs = { ...panel(data.costs, now), totalUSD: null, verifiedFeatures: null, perFeatureUSD: null };
  const features = data.costs?.features;
  // One receipt per verified feature, including all attempts in the same window.
  if (costs.available && Array.isArray(features) && features.every(f => f && label(f.id) && f.verified === true && number(f.costUSD) !== null && source(f.source)) && new Set(features.map(f => f.id)).size === features.length) {
    const total = features.reduce((sum, f) => sum + f.costUSD, 0);
    if (Number.isFinite(total)) Object.assign(costs, { totalUSD: total, verifiedFeatures: features.length, perFeatureUSD: features.length ? total / features.length : null,
      features: features.map(f => ({ id: label(f.id), costUSD: f.costUSD, source: source(f.source) })) });
  }
  const release = { ...panel(data.release, now), buildId: label(data.release?.buildId), gates: [] };
  if (release.available && Array.isArray(data.release.gates) && data.release.gates.every(g => g && source(g.source) && label(g.name) && ['passed', 'failed', 'pending'].includes(g.status))) release.gates = data.release.gates.map(g => ({ name: label(g.name), status: g.status, source: source(g.source) }));
  const product = { ...panel(data.product, now), outcomes: [] };
  if (product.available && Array.isArray(data.product.outcomes)) product.outcomes = data.product.outcomes.filter(o => o && source(o.source) && typeof o.value === 'number' && Number.isFinite(o.value) && label(o.unit) && ['observed', 'modeled', 'synthetic'].includes(o.kind)).map(o => ({ name: label(o.name), value: o.value, unit: label(o.unit), kind: o.kind, source: source(o.source) }));
  return { version: 1, generatedAt: new Date(now).toISOString(), queue, symphony, ci, costs, release, product };
}
async function readReport(path) {
  if (!path) return null;
  let file;
  try {
    file = await open(path, 'r');
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > LIMIT) return null;
    const buffer = Buffer.alloc(LIMIT + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return bytesRead > LIMIT ? null : JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
  } catch { return null; } finally { await file?.close(); }
}
export function createOperationsObservatoryHandler({ env = process.env, now = Date.now } = {}) {
  return async request => {
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, allow: 'GET, HEAD' } });
    const [data, coordinator] = await Promise.all([readReport(env.HBL_OPERATIONS_EVIDENCE_PATH), readReport(env.HBL_OPERATIONS_COORDINATOR_PATH)]);
    const result = projectObservatory(data, coordinator, now());
    return request.method === 'HEAD' ? new Response(null, { headers }) : Response.json(result, { headers });
  };
}
