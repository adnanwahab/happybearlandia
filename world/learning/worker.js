import { runPlan } from '../invention/model.js';

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ result: runPlan(data.plan, { retainMonths: data.retainMonths }) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
}, { once: true });
