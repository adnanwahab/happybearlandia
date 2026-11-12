import { runBakeryFuture } from './bakery-scenario.js';

self.onmessage = async ({ data }) => {
  try {
    const result = await runBakeryFuture({ reopenMonth: data.reopenMonth });
    self.postMessage({ id: data.id, result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
