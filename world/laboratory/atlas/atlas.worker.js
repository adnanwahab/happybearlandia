import { createAtlasSweep, runAtlasCell, runAtlasSample } from './model.js';

self.onmessage = ({ data: { type, recipe } }) => {
  try {
    if (type === 'sample') {
      self.postMessage({ type: 'sample', result: runAtlasSample(recipe) });
    } else if (type === 'sweep') {
      const sweep = createAtlasSweep(recipe);
      for (const cell of sweep.cells) {
        self.postMessage({ type: 'cell', cell: runAtlasCell(sweep, cell) });
      }
      self.postMessage({ type: 'complete' });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
