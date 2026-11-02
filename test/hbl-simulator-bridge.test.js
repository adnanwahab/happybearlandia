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
