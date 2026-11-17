import { tileStep } from './model.js';
self.onmessage = ({data}) => {
  try { self.postMessage({result:tileStep(data)}); }
  catch(error) { self.postMessage({error:error.message}); }
};
