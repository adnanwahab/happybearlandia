import { describe, expect, test } from "bun:test";
import { calibrateParameters, normalizeHistoricalDataset } from "../world/historical-calibration.js";

const experiment = { worldModel: { variables: [{ id: "effect", baseline: 0.2, range: { min: 0, max: 1 }, distribution: { type: "triangular", mode: 0.2, min: 0, max: 1 } }] } };
const dataset = { id: "synthetic", cases: [
  { id: "a", inputs: { exposure: 1 }, observed: { outcome: 0.75 } },
  { id: "b", inputs: { exposure: 0.5 }, observed: { outcome: 0.375 } },
] };
const simulateCase = ({ experiment, historicalCase }) => {
  const effect = experiment.worldModel.variables[0].baseline;
  return { metrics: { outcome: effect * historicalCase.inputs.exposure } };
};

describe("historical calibration", () => {
  test("normalizes historical cases", () => {
    expect(normalizeHistoricalDataset(dataset).schemaVersion).toBe("hbl-historical-dataset.v1");
  });
  test("recovers a synthetic coefficient and records calibration metadata", async () => {
    const result = await calibrateParameters({ experiment, dataset, parameterIds: ["effect"], simulateCase, metrics: ["outcome"], gridPoints: 21 });
    expect(result.parameters[0].fitted).toBeCloseTo(0.75, 2);
    expect(result.fitImprovement).toBeGreaterThan(0.9);
    expect(result.fittedExperiment.worldModel.variables[0].calibration.status).toBe("calibrated");
  });
});
