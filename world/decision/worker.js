// Server-side module Worker: never executes simulation work on Bun's HTTP loop.
import { executeDecisionExperiment } from "./kernel.js";
import { executeOptimizationJob } from "./optimization.js";
let cancelled = false;
let running = false;
self.onmessage = async ({ data }) => {
  if (data.type === "cancel") { cancelled = true; return; }
  if (!["start", "optimize"].includes(data.type) || running) return;
  running = true;
  try {
    const version = data.experiment?.modelVersion || data.config?.input?.modelVersion;
    const { housingModel, simulateHousingRun, simulateHousingFork, applyStressPresets } = await import(version === "1.0.0" ? "../models/housing/legacy-v1.js" : version === "1.1.0" ? "../models/housing/legacy-v1.1.js" : "../models/housing/index.js");
    if (housingModel.version !== version) throw new Error("Requested housing model version is unavailable");
    if (data.type === "optimize") {
      const result = await executeOptimizationJob({ config: data.config, model: housingModel, simulateRun: simulateHousingRun, simulateFork: simulateHousingFork, applyStressPresets, shouldCancel: () => cancelled, onProgress: (update) => self.postMessage({ type: "optimization-progress", update }) });
      self.postMessage({ type: "optimization-done", result }); return;
    }
    const result = await executeDecisionExperiment({
      experiment: data.experiment, model: housingModel, simulateRun: simulateHousingRun, simulateFork: simulateHousingFork, applyStressPresets,
      retainRuns: false, // Parent retains rows; avoid a second full monthly-state copy.
      shouldCancel: () => cancelled,
      onProgress: (update) => self.postMessage({ type: "progress", ...update }),
    });
    self.postMessage({ type: "done", status: result.status, progress: result.progress });
  } catch (error) {
    self.postMessage({ type: "error", error: String(error?.message || error) });
  }
};
