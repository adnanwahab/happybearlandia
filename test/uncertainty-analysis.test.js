import { describe, expect, test } from "bun:test";
import { attachUncertaintyMetadata, classifyVariableUncertainty, decomposeOutcomeUncertainty, topResearchQuestion } from "../world/uncertainty-analysis.js";

const experiment = { worldModel: { variables: [
  { id: "external_shock_probability", label: "External shock", category: "shocks", confidence: 0.7, range: { min: 0, max: 1 } },
  { id: "agency_capacity", label: "Agency capacity", category: "government", confidence: 0.2, range: { min: 0, max: 1 } },
] } };
const simulations = Array.from({ length: 20 }, (_, i) => {
  const agency = i / 19;
  const shock = (i % 5) / 4;
  return { score: agency * 100 - shock * 5, world: { conditions: { agency_capacity: agency, external_shock_probability: shock }, normalized: { agency_capacity: agency, external_shock_probability: shock } } };
});

describe("uncertainty decomposition", () => {
  test("distinguishes aleatory and epistemic uncertainty", () => {
    expect(classifyVariableUncertainty(experiment.worldModel.variables[0]).kind).toBe("aleatory");
    expect(classifyVariableUncertainty(experiment.worldModel.variables[1]).kind).toBe("epistemic");
    expect(attachUncertaintyMetadata(experiment).worldModel.variables[0].uncertainty.kind).toBe("aleatory");
  });
  test("ranks uncertain high-impact parameters for research", () => {
    const result = decomposeOutcomeUncertainty({ simulations }, experiment);
    expect(result.totals.aleatory + result.totals.epistemic).toBeCloseTo(1, 6);
    expect(result.researchPriorities[0].id).toBe("agency_capacity");
    expect(topResearchQuestion(result).variableId).toBe("agency_capacity");
  });
});
