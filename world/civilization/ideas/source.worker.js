import { isExperimentId } from './model.js';
import { projectContacts } from './source.js';

self.onmessage = async ({ data: id }) => {
  try {
    if (!isExperimentId(id)) throw new Error('Enter a valid Living World save ID.');
    const response = await fetch('/api/world-experiments/' + encodeURIComponent(id));
    if (response.status === 404) throw new Error('That Living World save could not be found.');
    if (!response.ok) throw new Error('The saved checkpoint could not be loaded. Try again.');
    const record = await response.json();
    if (record.id !== id) throw new Error('The checkpoint did not match the requested save.');
    self.postMessage({ source: projectContacts(record) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
