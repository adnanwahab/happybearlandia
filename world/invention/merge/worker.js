import { runMerge } from './merge.js';

self.addEventListener('message', ({ data: { left, right } }) => {
  try {
    self.postMessage({ result: runMerge(left, right) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
