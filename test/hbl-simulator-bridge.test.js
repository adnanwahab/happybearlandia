import { describe, expect, test } from "bun:test";
import {
  createHttpCivicSimulator,
  registerHblCivicSimulator,
  validateCivicSimulationResult,
} from "../world/hbl-simulator-bridge.js";
import { resolveSimulationAdapter } from "../world/simulation-adapter.js";

const experiment = { outcomes: { metricRegistry: [{ id: "housing_units_permitted" }] } };

describe("HBL simulator bridge", () => {
  test("registers an in-process simulator with explicit metadata", async () => {
    const fakeWindow = {};
    registerHblCivicSimulator(fakeWindow, async () => ({ score: 81, metrics: { housing_units_permitted: 100 } }), {
      id: "housing.v1",
      predictive: true,
    });
    const adapter = await resolveSimulationAdapter(fakeWindow);
    expect(adapter.id).toBe("housing.v1");
    expect(adapter.predictive).toBe(true);
    expect((await adapter.simulateWorld({ experiment, world: {} })).score).toBe(81);
  });

  test("supports an HTTP simulator endpoint", async () => {
    const calls = [];
    const runner = createHttpCivicSimulator("/api/sim", {
      fetchImpl: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ result: { score: 63, metrics: { housing_units_permitted: 50 } } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const result = await runner({ experiment, world: { id: "w1" } });
    expect(result.score).toBe(63);
    expect(calls[0].body.schemaVersion).toBe("civic-simulation-request.v1");
  });

  test("rejects non-finite simulator outputs", () => {
    expect(validateCivicSimulationResult({ score: NaN }).ok).toBe(false);
    expect(validateCivicSimulationResult({ score: 10, metrics: { bad: Infinity } }).ok).toBe(false);
  });
});

for (const failure of ['offline', '500', 'timeout', 'body-timeout']) {
  test(`recovers ${failure} once using exactly the same versioned input`, async () => {
    const calls = [];
    const runner = createHttpCivicSimulator('/sim', { timeoutMs: 10, fetchImpl: async (_, init) => {
      calls.push(init);
      if (calls.length === 1) {
        if (failure === 'offline') throw new TypeError('offline');
        if (failure === '500') return new Response('', { status: 500 });
        if (failure === 'body-timeout') return { ok: true, json: () => new Promise(() => {}) };
        return new Promise(() => {});
      }
      return Response.json({ score: 17, model: { version: 'pinned-v1' }, disclaimer: 'Synthetic' });
    } });
    const result = await runner({ experiment, world: { id: 'w1', seed: 42 } });
    expect(result.model.version).toBe('pinned-v1');
    expect(result.disclaimer).toBe('Synthetic');
    expect(calls).toHaveLength(2);
    expect(calls[0].body).toBe(calls[1].body);
    if (failure.includes('timeout')) expect(calls[0].signal.aborted).toBe(true);
  });
}

test('persistent failure stops after two attempts', async () => {
  let calls = 0;
  const runner = createHttpCivicSimulator('/sim', { fetchImpl: async () => { calls++; return new Response('', { status: 500 }); } });
  await expect(runner({ experiment, world: {} })).rejects.toThrow('Simulation unavailable');
  expect(calls).toBe(2);
});

test('missing data, invalid JSON and permanent HTTP errors never become success', async () => {
  for (const response of [() => Response.json({}), () => Response.json({ score: null }), () => new Response('invalid'), () => new Response('', { status: 404 })]) {
    let calls = 0;
    const runner = createHttpCivicSimulator('/sim', { fetchImpl: async () => { calls++; return response(); } });
    await expect(runner({ experiment, world: {} })).rejects.toThrow();
    expect(calls).toBe(1);
  }
});

test('persistent timeout is bounded and aborts both attempts', async () => {
  const signals = [];
  const runner = createHttpCivicSimulator('/sim', { timeoutMs: 5, fetchImpl: (_, init) => { signals.push(init.signal); return new Promise(() => {}); } });
  await expect(runner({ experiment, world: {} })).rejects.toThrow('timed out');
  expect(signals).toHaveLength(2);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});
