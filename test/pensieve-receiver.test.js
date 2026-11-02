import { describe, expect, test } from "bun:test";
import { createPensieveCivicReceiver, summarizeReceivedExperiment, validatePensieveMessage } from "../world/pensieve-receiver.js";

const handoff = {
  schemaVersion: "pensieve-civic-handoff.v1",
  source: { experimentId: "exp_1", recordId: "record_1", revision: 2 },
  exhibit: { title: "Housing" },
  snapshot: { experiment: { id: "exp_1", plan: { id: "plan_1", title: "Housing" }, experiment: { horizonYears: 10 }, lineage: { revision: 2 } }, worldBatch: { runs: 1000 } },
};

describe("pensieve receiver", () => {
  test("rejects untrusted origins", () => {
    const result = validatePensieveMessage({ origin: "https://evil.example", data: { type: "hbl:pensieve-civic-handoff", payload: handoff } }, { allowedOrigins: ["https://digital-pensieve.fly.dev"] });
    expect(result.ok).toBe(false);
  });
  test("accepts trusted handoffs and summarizes them", () => {
    const receiver = createPensieveCivicReceiver({ allowedOrigins: ["https://happybearlandia.fly.dev"] });
    const result = receiver.acceptEvent({ origin: "https://happybearlandia.fly.dev", data: { type: "hbl:pensieve-civic-handoff", payload: handoff } });
    expect(result.ok).toBe(true);
    expect(result.summary.runs).toBe(1000);
    expect(summarizeReceivedExperiment(handoff).revision).toBe(2);
  });
});
