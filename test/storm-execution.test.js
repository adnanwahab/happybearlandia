import { expect, test } from 'bun:test';
import { checkWaterGPULimits, waterGPURequirements } from '../world/storm/gpu.js';
import { prepareWaterInput, simulateWater } from '../world/storm/physics.js';
import { runStormPair, stormWorkerResult } from '../world/storm/execution.js';

const inputs = { baseline: { size: 3, steps: 4, rainRate: 0.125 }, adjusted: { size: 3, steps: 4, rainRate: 0.1 } };
const fail = async () => { throw Error('injected failure'); };

test('requirements include readback allocation, storage bindings and dispatch dimensions', () => {
  const requirements = waterGPURequirements(prepareWaterInput({ size: 128, steps: 240 }));
  expect(requirements).toMatchObject({ maxStorageBufferBindingSize: 65536, maxBufferSize: 15728640,
    maxComputeWorkgroupsPerDimension: 256, maxComputeWorkgroupSizeX: 64, maxStorageBuffersPerShaderStage: 4 });
  expect(() => checkWaterGPULimits(requirements, requirements, 'adapter')).not.toThrow();
  for (const name of Object.keys(requirements)) {
    expect(() => checkWaterGPULimits({ ...requirements, [name]: requirements[name] - 1 }, requirements, 'adapter')).toThrow(name);
    expect(() => checkWaterGPULimits({}, requirements, 'device')).toThrow();
  }
});

test('GPU success does not invoke worker; partial GPU failure recomputes both arms on worker', async () => {
  const success = await runStormPair(inputs, { gpu: async value => simulateWater(value), worker: fail });
  expect(success.path).toBe('WebGPU');
  expect(success.reasons).toEqual([]);
  let calls = 0;
  const result = await runStormPair(inputs, {
    gpu: async value => { if (++calls === 2) throw Error('device lost'); return simulateWater(value); },
    worker: async data => [simulateWater(data.baseline), simulateWater(data.adjusted)],
  });
  expect(result.path).toBe('CPU worker');
  expect(result.runs).toEqual([simulateWater(inputs.baseline), simulateWater(inputs.adjusted)]);
  expect(result.reasons[0]).toContain('device lost');
});

test('GPU and worker failure preserve exact reference results and report visible fallback', async () => {
  const statuses = [];
  const result = await runStormPair(inputs, { gpu: fail, worker: fail, onFallback: value => statuses.push(value) });
  expect(result.path).toBe('CPU on main thread');
  expect(result.runs).toEqual([simulateWater(inputs.baseline), simulateWater(inputs.adjusted)]);
  expect(statuses).toHaveLength(2);
  expect(statuses[1]).toContain('Worker unavailable');
  await expect(runStormPair({ ...inputs, baseline: { size: 999 } }, { gpu: fail })).rejects.toThrow('Grid size');
});

test('worker startup, posting, message, execution and timeout failures release worker', async () => {
  await expect(stormWorkerResult({}, { WorkerClass: null })).rejects.toThrow();
  for (const mode of ['post', 'error', 'messageerror', 'invalid', 'reported', 'timeout', 'success']) {
    let terminated = 0;
    class FakeWorker {
      terminate() { terminated++; }
      postMessage() {
        if (mode === 'post') throw Error('post failed');
        if (mode === 'error') this.onerror();
        if (mode === 'messageerror') this.onmessageerror();
        if (mode === 'invalid') this.onmessage({ data: {} });
        if (mode === 'reported') this.onmessage({ data: { error: 'solver failed' } });
        if (mode === 'success') this.onmessage({ data: { result: [1, 2] } });
      }
    }
    const promise = stormWorkerResult({}, { WorkerClass: FakeWorker, timeoutMs: 1 });
    if (mode === 'success') expect(await promise).toEqual([1, 2]);
    else await expect(promise).rejects.toThrow();
    expect(terminated).toBe(1);
  }
});

test('actual GPU entry rejects low adapter/device limits before pipeline or buffers', async () => {
  const { simulateWaterGPU } = await import('../world/storm/gpu.js');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const requirements = waterGPURequirements(prepareWaterInput(inputs.baseline));
  let requested = 0, destroyed = 0;
  function install(adapter) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => adapter } } });
  }
  try {
    install(null);
    await expect(simulateWaterGPU(inputs.baseline)).rejects.toThrow('No WebGPU');
    install({ limits: { ...requirements, maxStorageBufferBindingSize: 1 }, requestDevice() { requested++; } });
    await expect(simulateWaterGPU(inputs.baseline)).rejects.toThrow('adapter maxStorageBufferBindingSize');
    expect(requested).toBe(0);
    install({ limits: requirements, requestDevice(...args) {
      requested++;
      expect(args).toEqual([]);
      return { limits: { ...requirements, maxBufferSize: 1 }, destroy() { destroyed++; } };
    } });
    await expect(simulateWaterGPU(inputs.baseline)).rejects.toThrow('device maxBufferSize');
    expect(requested).toBe(1);
    expect(destroyed).toBe(1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});
