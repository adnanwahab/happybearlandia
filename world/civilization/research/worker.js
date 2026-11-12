import { runPlannerExperiment } from './experiment.js';

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ result: runPlannerExperiment(data) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
