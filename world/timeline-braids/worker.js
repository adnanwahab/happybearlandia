import { loadBraids } from './model.js';

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ result: await loadBraids(data) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
