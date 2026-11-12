import { runReverseSearch } from './model.js';

self.onmessage = ({ data: goal }) => {
  try {
    const report = runReverseSearch(goal, progress => {
      if (progress.completed % 8 === 0 || progress.completed === progress.total) {
        self.postMessage({ type: 'progress', progress });
      }
    });
    self.postMessage({ type: 'result', report });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
