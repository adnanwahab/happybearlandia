import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isSimulationSubmission } from './simulation-admission.js';
import { initialForRecipe, normalizeReplay } from '../../world/future-machine/data/index.js';
import { DEFAULT_RECIPE } from '../../world/future-machine/contracts.js';
import { addIntervention, createEngine } from '../../world/city/engine.js';
import { stateHash } from '../../world/future-machine/data/core.js';

// Compute once, before accepting traffic; never create persisted experiments.
export async function buildEmergencyComparison() {
  const initial = initialForRecipe();
  const initialHash = await stateHash(initial);
  if (initialHash !== '7767de6b19f3b1c62f218c3a4ee26739157382db2c7ff962dbe141fc160821ae') throw new Error('Emergency default initial state verification failed');
  const run = intervention => {
    const engine = createEngine(), steps = [];
    let state = intervention ? addIntervention(structuredClone(initial), intervention) : structuredClone(initial);
    for (let month = 1; month <= 120; month++) {
      const step = engine.step(state); steps.push(step); state = step.state;
    }
    return normalizeReplay(initial, { steps });
  };
  const baseline = run(null), plan = run(DEFAULT_RECIPE.intervention);
  if (baseline[120].metrics.housingUnits !== 36 || plan[120].metrics.housingUnits !== 60 || plan[120].metrics.capitalSpending !== 1000000) throw new Error('Emergency default outcome verification failed');
  const baselineHash = await stateHash(baseline), planHash = await stateHash(plan);
  if (baselineHash !== '9dbadec39af6ce3c14f742ba44dc9f52dae39c99402a20a59cabd6e3769fff29' || planHash !== 'eb2744e2b7fda6f9677300bf9ded8a058d5d448cd2ecdf091ba850c5789eaa68') throw new Error('Emergency default history verification failed');
  const rows = baseline.map((frame, month) => `<tr><th>${month}</th><td>${frame.metrics.housingUnits}</td><td>${plan[month].metrics.housingUnits}</td><td>${plan[month].metrics.capitalSpending}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Read-only comparison · HappyBearLandia</title><style>body{font:1rem/1.5 system-ui;margin:2rem auto;padding:0 1rem;max-width:65rem}table{border-collapse:collapse;width:100%}th,td{padding:.5rem;text-align:left;border-bottom:1px solid #aaa}p{overflow-wrap:anywhere}caption{font-weight:bold;text-align:left}</style><main><h1>Read-only play is available</h1><p role="status">Emergency mode is active. New simulation submissions and live previews are paused. Previously accepted jobs may finish. Your saved comparisons are retained. This is the default comparison, not a reopened shared scenario.</p><p>Synthetic, uncalibrated monthly City model; not a forecast or real parcel data. Recomputed once at server startup and checked against the default initial hash and terminal homes/spending. No independent recorded-checkpoint verification.</p><p>Seed ${DEFAULT_RECIPE.seed} · model ${DEFAULT_RECIPE.modelVersion} · recipe ${DEFAULT_RECIPE.schemaVersion} · source future-machine-synthetic.v1 · initial SHA-256 ${initialHash}</p><p>Full normalized history SHA-256: baseline ${baselineHash}; plan ${planHash}.</p><p>Inputs: 30 households, 120 months; 24 proposed homes in d1, 1,000,000 illustrative USD, delay 0, compliance 1. Private parcel capacity 0, utility capacity 200, annual growth 0. No calibrated uncertainty interval.</p><p><a href="/world/future-machine.html">Check whether normal play has resumed</a></p><table><caption>Explore both futures by month. Spending is cumulative illustrative USD in the plan; baseline spending is zero.</caption><thead><tr><th>Month</th><th>Baseline homes</th><th>Plan homes</th><th>Plan capital spending (USD)</th></tr></thead><tbody>${rows}</tbody></table></main></html>`;
}

export function createEmergencyMode({ file, comparison, stat = statSync } = {}) {
  if (file && !isAbsolute(file)) throw new Error('HBL_EMERGENCY_FILE must be absolute');
  function active() {
    if (!file) return false;
    try { stat(file); return true; } catch (error) {
      // Missing flag is normal; permission and storage errors fail closed.
      return error.code !== 'ENOENT';
    }
  }
  return request => {
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    const enabled = active();
    const headers = { 'cache-control': 'no-store' };
    if (path === '/api/emergency-mode' && request.method === 'GET') return Response.json({ active: enabled, comparison: '/world/future-machine.html' }, { headers });
    if (!enabled) return null;
    if (['/', '/world/future-machine.html', '/world/future-machine'].includes(path || '/') && ['GET', 'HEAD'].includes(request.method)) {
      return new Response(request.method === 'HEAD' ? null : comparison, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    }
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const simulation = isSimulationSubmission(request) || (mutation && /^\/api\/(experiments|city-experiments|world-experiments|world-homes|world-edits)(\/|$)/.test(path));
    const preview = mutation && /^\/api\/github\/(?:pulls\/[1-9]\d*\/)?previews(?:\/|$)/.test(path) && !path.endsWith('/stop');
    if ((simulation && !/\/(cancel|pause)$/.test(path)) || preview) return Response.json({ code: 'emergency_read_only', error: 'Emergency mode: new simulations and live previews are paused. Open /world/future-machine.html for the verified synthetic default comparison.', comparison: '/world/future-machine.html' }, { status: 503, headers: { ...headers, 'retry-after': '60' } });
    return null;
  };
}
