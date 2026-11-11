import { runFutureSplit } from './model.js';

self.onmessage = ({ data: recipe }) => {
  try {
    self.postMessage({ run: runFutureSplit(recipe) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
