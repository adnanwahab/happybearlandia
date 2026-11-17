import { simulateWaterGPU } from './gpu.js';
import { prepareWaterInput, simulateWater } from './physics.js';

export function stormWorkerResult(data, { WorkerClass = globalThis.Worker, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let worker, timer;
    let settled = false;
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker?.terminate();
      if (error) reject(error);
      else resolve(result);
    }
    try {
      worker = new WorkerClass(new URL('./worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (data?.error) finish(new Error(data.error));
        else if (Array.isArray(data?.result) && data.result.length === 2) finish(null, data.result);
        else finish(new Error('Invalid storm worker result.'));
      };
      worker.onerror = () => finish(new Error('The storm worker could not run.'));
      worker.onmessageerror = () => finish(new Error('The storm worker result could not be read.'));
      timer = setTimeout(() => finish(new Error('The storm worker timed out.')), timeoutMs);
      worker.postMessage(data);
    } catch (error) { finish(error); }
  });
}

/** Recompute both arms on one backend. Never change model inputs to fit hardware. */
export async function runStormPair(inputs, { gpu = simulateWaterGPU, worker = stormWorkerResult, onFallback = () => {} } = {}) {
  // Invalid inputs are model errors, not hardware failures.
  const baseline = prepareWaterInput(inputs.baseline);
  const adjusted = prepareWaterInput(inputs.adjusted);
  const reasons = [];
  try {
    return { runs: [await gpu(baseline), await gpu(adjusted)], path: 'WebGPU', reasons };
  } catch (error) {
    reasons.push(`WebGPU unavailable: ${error.message}`);
    onFallback(`Using CPU worker · ${reasons.join(' ')}`);
  }
  try {
    return { runs: await worker({ type: 'storm', baseline, adjusted }), path: 'CPU worker', reasons };
  } catch (error) {
    reasons.push(`Worker unavailable: ${error.message}`);
    onFallback(`Using CPU on main thread · ${reasons.join(' ')}`);
  }
  // This reference is bounded by WATER_LIMITS; yield so the fallback status can paint.
  await new Promise(resolve => setTimeout(resolve, 0));
  return { runs: [simulateWater(baseline), simulateWater(adjusted)], path: 'CPU on main thread', reasons };
}
