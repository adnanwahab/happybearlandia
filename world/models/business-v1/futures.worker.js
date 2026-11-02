import { runFutures } from './futures.js';
self.onmessage = async ({ data }) => {
  try {
    const result = await runFutures(data.state, data.plan, { ...data.options, onProgress: progress => self.postMessage({ type: 'progress', progress }) });
    self.postMessage({ type: 'done', result });
  } catch (error) { self.postMessage({ type: 'error', error: error.message }); }
};
