import { DECISION_ENGINE_VERSION } from './contracts.js';

/** Small same-origin client; progressive polling remains usable without SSE. */
export function createDecisionClient({ base = '/api/decision-experiments', fetcher = (...args) => fetch(...args) } = {}) {
  async function request(path = '', method = 'GET', body) {
    const response = await fetcher(`${base}${path}`, {
      method, headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || `Request failed (${response.status})`);
    return payload;
  }
  const key = id => `/${encodeURIComponent(id)}`;
  return {
    list: () => request(), create: input => request('', 'POST', input),
    get: id => request(key(id)), start: id => request(`${key(id)}/start`, 'POST', {}),
    cancel: id => request(`${key(id)}/cancel`, 'POST', {}),
    results: (id, { traces = 'summary' } = {}) => request(`${key(id)}/results${traces === 'summary' ? '?traces=summary' : ''}`), manifest: id => request(`${key(id)}/manifest`),
    share: (id, { traces = 'summary' } = {}) => request(`${key(id)}/share${traces === 'summary' ? '?traces=summary' : ''}`),
    visualRevision: (id, input) => request(`${key(id)}/visual-revision?traces=summary`, 'POST', { input }), run: (id, runId) => request(`${key(id)}/runs/${encodeURIComponent(runId)}`),
    watch(id, { onUpdate, onError, interval = 400, traces = 'summary' } = {}) {
      let stopped = false, timer;
      async function tick() {
        try {
          const result = await request(`${key(id)}/results${traces === 'summary' ? '?traces=summary' : ''}`);
          if (stopped) return;
          await onUpdate?.(result);
          if (['completed', 'cancelled', 'failed'].includes(result.experiment?.status)) { stopped = true; return; }
          timer = setTimeout(tick, interval);
        } catch (error) { if (!stopped) { stopped = true; onError?.(error); } }
      }
      tick();
      return { destroy() { stopped = true; clearTimeout(timer); } };
    },
  };
}

/** At most two complete traces for the current experiment. Generation checks
 * discard late responses after navigation; progressive result objects stay separate.
 */
export function createRunTraceCache({ loadRun, limit = 2 } = {}) {
  if (typeof loadRun !== 'function') throw new TypeError('A run loader is required.');
  const capacity = Math.max(1, Math.min(2, limit));
  let experimentId = null, generation = 0;
  const cache = new Map(), pending = new Map();
  function setExperiment(id) { if (id !== experimentId) { experimentId = id; generation++; cache.clear(); pending.clear(); } }
  function peek(id, runId) { return id === experimentId ? cache.get(runId) || null : null; }
  async function get(id, runId) {
    setExperiment(id);
    if (cache.has(runId)) { const row=cache.get(runId);cache.delete(runId);cache.set(runId,row);return row; }
    if (pending.has(runId)) return pending.get(runId);
    const token = generation;
    const promise = Promise.resolve().then(() => loadRun(id,runId)).then(payload => {
      if (token !== generation || id !== experimentId) return null;
      const row = payload?.run || payload;
      if (!row || row.id !== runId || row.experimentId && row.experimentId !== id) throw new Error('The full trace response does not match the requested future.');
      cache.set(runId,row);while(cache.size>capacity)cache.delete(cache.keys().next().value);
      return row;
    }).finally(() => { if(token===generation && pending.get(runId)===promise)pending.delete(runId); });
    pending.set(runId,promise);return promise;
  }
  return { get,peek,setExperiment,clear(){setExperiment(null);},get size(){return cache.size;},get experimentId(){return experimentId;} };
}
export function mergeRunTrace(summary, full) {
  if (!full || full.id !== summary.id) return summary;
  // Summary fields win for status/metrics/progress. Only complete trace arrays are
  // overlaid, so an older trace never replaces a newer progressive snapshot.
  const merged = { ...full, ...summary, traceDelivery: 'loaded' };
  for (const key of ['monthlyTimeline','projects']) if (full[key] !== undefined) merged[key] = full[key];
  return merged;
}

/** RFC4180-style CSV reader, including quoted delimiters, CRLF and newlines. */
export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const input = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length) throw new Error('Unexpected quote in CSV field.');
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('CSV needs a header and at least one data row.');
  const headers = rows.shift().map(v => v.trim());
  if (headers.some(v => !v) || new Set(headers).size !== headers.length) throw new Error('Column names must be nonempty and unique.');
  if (rows.some(row => row.length !== headers.length)) throw new Error('Every CSV row must have the same number of columns as its header.');
  return rows.map(row => Object.fromEntries(headers.map((header, i) => [header, row[i]])));
}

export function parseParameterUpload(text, filename = '') {
  const json = filename.toLowerCase().endsWith('.json') || /^[\s]*[\[{]/.test(text);
  if (!json) return parseCSV(text);
  const data = JSON.parse(text);
  if (data?.schemaVersion === 'decision-experiment.v1' || data?.input || data?.experiment?.scenarios || data?.scenarios) return { manifest: data };
  const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [data?.parameters || data];
  if (!rows.length || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('JSON must contain an object or an array of row objects.');
  // Common long-form parameter/value files become one editable wide input row.
  if (rows.every(row => typeof (row.parameter ?? row.parameterId) === 'string' && 'value' in row)) {
    return [Object.fromEntries(rows.map(row => [row.parameter ?? row.parameterId, row.value]))];
  }
  return rows;
}

export function experimentInputFromManifest(payload) {
  if (payload?.engineVersion && payload.engineVersion !== DECISION_ENGINE_VERSION) throw new Error(`This manifest needs engine ${payload.engineVersion}; available engine is ${DECISION_ENGINE_VERSION}.`);
  const candidates = [payload?.input?.experiment, payload?.input, payload?.experiment?.input, payload?.experiment, payload];
  const input = candidates.find(value => value && Array.isArray(value.scenarios));
  if (!input || input.schemaVersion !== 'decision-experiment.v1') throw new Error('File does not contain a decision-experiment.v1 input.');
  return structuredClone(input);
}
