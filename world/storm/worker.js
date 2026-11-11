import { runStormEnsemble } from './compare.js';
import { simulateWater } from './physics.js';

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'ensemble') {
      const result = runStormEnsemble(data.recipe, completed => self.postMessage({ completed }));
      self.postMessage({ result });
    } else {
      self.postMessage({ result: [simulateWater(data.baseline), simulateWater(data.adjusted)] });
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
