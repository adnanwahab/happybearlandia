import { compareHiddenSystems } from './model.js';

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ comparison: compareHiddenSystems(data) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
}, { once: true });
