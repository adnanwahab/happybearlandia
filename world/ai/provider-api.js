/** SERVER INTEGRATION: import createWorldEditApiHandler in server.js; route
 * /api/world-edits/* before static handlers. Block /world/ai/{provider,openai,
 * anthropic,gemini,provider-api}.js from static serving. No env values or vendor
 * error bodies are returned. Tests inject env/fetchImpl; never call paid APIs.
 */
import { getWorldEditProviders, proposeWorldEdit, WorldEditProviderError } from './provider.js';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
async function readInput(request) {
  if (Number(request.headers.get('content-length')) > 262144) throw new WorldEditProviderError('World-edit input exceeds 256 KiB.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorldEditProviderError('A JSON edit request is required.');
  const chunks = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 262144) { await reader.cancel(); throw new WorldEditProviderError('World-edit input exceeds 256 KiB.', 413); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const value of chunks) { bytes.set(value, offset); offset += value.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new WorldEditProviderError('World-edit input must be valid JSON.'); }
}
export function createWorldEditApiHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const windows = new Map();
  return async request => {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/api/world-edits/providers') return request.method === 'GET' ? json(getWorldEditProviders(env)) : json({ error: 'Use GET.' }, 405);
      if (url.pathname !== '/api/world-edits/propose') return json({ error: 'World-edit route not found.' }, 404);
      if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'World-edit requests must be same-origin.' }, 403);
      const body = await readInput(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WorldEditProviderError('A JSON edit object is required.');
      const input = body.input;
      const scenario = Array.isArray(input?.scenarios) ? input.scenarios.find(row => row.id === body.scenarioId) : null;
      if (!scenario) throw new WorldEditProviderError('Select an existing scenario.');
      if ((body.provider || env.AI_PROVIDER || 'demo') !== 'demo') {
        const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 96) || 'local';
        const now = Date.now();
        for (const [id, record] of windows) if (record.until <= now) windows.delete(id);
        const record = windows.get(key) || { count: 0, until: now + 60000 };
        if (record.count >= 10 || windows.size >= 1000 && !windows.has(key)) return json({ error: 'Provider proposal rate limit reached. Try again later.' }, 429);
        record.count++; windows.set(key, record);
      }
      const proposal = await proposeWorldEdit({ prompt: body.prompt, provider: body.provider, worldState: input, scenario, selection: body.selection, env, fetchImpl, timeoutMs });
      return json({ proposal });
    } catch (error) {
      return json({ error: error instanceof WorldEditProviderError ? error.message : 'World-edit proposal failed. No changes were applied.' }, error instanceof WorldEditProviderError ? error.status : 500);
    }
  };
}
