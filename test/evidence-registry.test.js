import { describe, expect, test } from "bun:test";
import { attachEvidenceLayer, normalizeEvidenceRecord, summarizeEvidence } from "../world/evidence-registry.js";

const experiment = {
  worldModel: {
    variables: [
      { id: "interest_rate", baseline: 0.05, unit: "fraction", source: "heuristic-default", confidence: 0.5 },
      { id: "agency_capacity", baseline: 0.7, unit: "index", source: "user-override", confidence: 1 },
    ],
    causalEdges: [{ id: "edge_1", from: "interest_rate", to: "financial_capacity", strength: 0.7 }],
  },
  outcomes: { metricRegistry: [{ id: "median_housing_cost", unit: "currency" }] },
};

describe("evidence registry", () => {
  test("normalizes bounded confidence and stable schema", () => {
    const row = normalizeEvidenceRecord({ id: "x", type: "observed", confidence: 2, value: 5 });
    expect(row.schemaVersion).toBe("hbl-evidence.v1");
    expect(row.confidence).toBe(1);
  });

  test("attaches provenance without discarding model values", () => {
    const enriched = attachEvidenceLayer(experiment, {
      evidenceRegistry: { variables: { interest_rate: { type: "observed", sourceName: "Federal Reserve", confidence: 0.95, value: 0.05, geography: "US" } } },
    });
    expect(enriched.worldModel.variables[0].baseline).toBe(0.05);
    expect(enriched.worldModel.variables[0].provenance.type).toBe("observed");
    expect(enriched.worldModel.variables[0].evidence[0].sourceName).toBe("Federal Reserve");
    expect(enriched.worldModel.variables[1].provenance.type).toBe("user-override");
    expect(summarizeEvidence(enriched).observed).toBe(1);
  });
});
