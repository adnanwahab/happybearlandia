import { describe, expect, test } from "bun:test";
import {
  createExperimentRecord,
  summarizeExperimentRecord,
  traceRecordLineage,
} from "../world/experiment-record.js";

const experiment = {
  id: "exp_1",
  plan: { id: "plan_1", title: "Housing plan" },
  experiment: { seed: 42 },
  lineage: { revision: 1 },
};

describe("experiment records and lineage", () => {
  test("creates stable record ids for the same experiment state", () => {
    const a = createExperimentRecord({ experiment, overrides: { x: { baseline: 1 } } }, new Date("2026-01-01T00:00:00Z"));
    const b = createExperimentRecord({ experiment, overrides: { x: { baseline: 1 } } }, new Date("2026-02-01T00:00:00Z"));
    expect(a.id).toBe(b.id);
    expect(a.savedAt).not.toBe(b.savedAt);
  });

  test("stores scenario-family comparison alongside the experiment snapshot", () => {
    const record = createExperimentRecord({
      experiment,
      scenarioComparison: { schemaVersion: "scenario-family-outcomes.v1", weakestFamilyId: "recession" },
    });
    expect(record.scenarioComparison.weakestFamilyId).toBe("recession");
    expect(record.codeVersion).toBe("hbl-civic-experiment-lab.v3");
  });

  test("traces parent record lineage in chronological ancestry order", () => {
    const root = createExperimentRecord({ experiment }, new Date("2026-01-01T00:00:00Z"));
    const revisedExperiment = { ...experiment, id: "exp_2", lineage: { revision: 2, parentExperimentId: "exp_1" } };
    const child = createExperimentRecord({ experiment: revisedExperiment, parentRecordId: root.id, revision: 2 });
    expect(traceRecordLineage([child, root], child.id).map((row) => row.id)).toEqual([root.id, child.id]);
    expect(summarizeExperimentRecord(child)).toMatchObject({ title: "Housing plan", revision: 2 });
  });
});
