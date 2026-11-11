import { runPlan } from '../model.js';

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ result: runPlan(data, { retainMonths: true }) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
}, { once: true });
