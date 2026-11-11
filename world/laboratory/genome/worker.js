import { compareGenome } from './model.js';

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ result: compareGenome(data) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
