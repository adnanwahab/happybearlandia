import { mountProductWorkflows } from './ui.js';
/** Call only from the user's explicit local-workflow panel-open action. */
export async function openLocalProductWorkflows(container, options = {}) {
  const transport = options.fetch || globalThis.fetch;
  const response = await transport('/api/local-capability', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Local workflows require a same-origin loopback session');
  const capability = await response.json();
  if (capability.localOnly !== true) throw new Error('Invalid local capability receipt');
  return mountProductWorkflows(container, { ...options, fetch: transport, endpoint: '/api/product-workflows' });
}
