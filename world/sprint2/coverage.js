const PAGE_SIZE = 100;
const CONCURRENCY = 8;
const DEPENDENCIES = new Set(['causes', 'contributes', 'constrains']);
const DESCRIPTIVE = new Set(['narrative', 'render', 'wall-clock', 'descriptive']);

async function* pages(read, path, params, cursorKey, signal) {
  let cursor = null;
  do {
    const page = await read(path, {
      ...params, limit: PAGE_SIZE, ...(cursor === null ? {} : {[cursorKey]: cursor})
    }, signal);
    yield page.items;
    cursor = page.nextCursor;
  } while (cursor != null);
}

export async function* listCoverageRuns(read, signal) {
  yield* pages(read, 'runs', {}, 'afterId', signal);
}

function hasProvenance(record) {
  const provenance = record.provenance;
  return Boolean(provenance?.kind && provenance.source && provenance.modelVersion);
}

function classifyExplanation(explanation, targetId) {
  const edges = explanation.edges.filter(edge => edge.toId === targetId && DEPENDENCIES.has(edge.relation));
  const evidenceIds = new Set(explanation.evidence.map(record => record.id));
  const withEvidence = edges.some(edge => hasProvenance(edge) && edge.evidenceIds?.length > 0 &&
    edge.evidenceIds.every(id => evidenceIds.has(id)));
  // A depth limit here only omits ancestors beyond the direct incoming edges.
  const uncertain = explanation.reasons.some(reason => reason !== 'depth-limit' && !reason.startsWith('run-'));
  return {
    status: edges.length ? 'linked' : uncertain ? 'unknown' : 'unlinked',
    withEvidence,
    evidenceUnknown: !withEvidence && uncertain,
    sources: edges.map(edge => edge.provenance).filter(provenance => provenance?.source)
  };
}

export async function loadCoverage(read, runId, {signal, onProgress = () => {}} = {}) {
  const {run} = await read('run', {runId}, signal);
  const groups = new Map();
  const sources = new Map();
  let checked = 0;
  let descriptive = 0;

  for (const kind of ['events', 'observations']) {
    for await (const records of pages(read, kind, {runId}, 'afterSequence', signal)) {
      for (let i = 0; i < records.length; i += CONCURRENCY) {
        await Promise.all(records.slice(i, i + CONCURRENCY).map(async record => {
          const replay = record.payload?.replayEvent ?? record.payload;
          if (kind === 'events' && DESCRIPTIVE.has(replay?.replayKind)) {
            descriptive++;
            return;
          }

          const domain = replay?.domain ?? record.payload?.system ?? run.metadata?.manifest?.domain ?? 'Unknown';
          const type = kind === 'events' ? record.type : record.metricId;
          const key = JSON.stringify([domain, kind, type]);
          if (!groups.has(key)) groups.set(key, {
            domain, kind, type, total: 0, linked: 0, unlinked: 0, unknown: 0,
            withEvidence: 0, evidenceUnknown: 0, withProvenance: 0
          });
          const group = groups.get(key);
          let result;
          try {
            const explanation = await read('explain', {
              runId, targetId: record.id, maxDepth: 1, maxNodes: 500, maxEdges: 1000
            }, signal);
            result = classifyExplanation(explanation, record.id);
          } catch (error) {
            if (signal?.aborted) throw error;
            result = {status: 'unknown', evidenceUnknown: true, sources: []};
          }

          group.total++;
          group[result.status]++;
          group.withEvidence += Number(Boolean(result.withEvidence));
          group.evidenceUnknown += Number(result.evidenceUnknown);
          group.withProvenance += Number(hasProvenance(record));
          for (const {kind, source, modelVersion} of result.sources) {
            const key = JSON.stringify([kind, source, modelVersion]);
            if (!sources.has(key)) sources.set(key, {kind, source, modelVersion, count: 0});
            sources.get(key).count++;
          }
          checked++;
        }));
        onProgress(checked);
      }
    }
  }

  const {run: latest} = await read('run', {runId}, signal);
  if (latest.revision !== run.revision || latest.status !== run.status) {
    throw new Error('The run changed while coverage was loading. Refresh coverage to try again.');
  }
  const rows = [...groups.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain) || a.kind.localeCompare(b.kind) || a.type.localeCompare(b.type));
  const totals = {total: 0, linked: 0, unlinked: 0, unknown: 0, withEvidence: 0, evidenceUnknown: 0, withProvenance: 0};
  for (const row of rows) {
    for (const key of Object.keys(totals)) totals[key] += row[key];
  }
  return {run, rows, totals, descriptive, sources: [...sources.values()].sort((a, b) => b.count - a.count)};
}

async function read(path, params, signal) {
  const response = await fetch(`/api/causality/${path}?${new URLSearchParams(params)}`, {signal});
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `Causality API returned HTTP ${response.status}.`);
  }
  return response.json();
}

function renderRows(body, rows) {
  body.replaceChildren(...rows.map(values => {
    const row = document.createElement('tr');
    for (const [index, value] of values.entries()) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
}

function mount() {
  const form = document.querySelector('form');
  const select = document.querySelector('#run');
  const status = document.querySelector('#status');
  const catalog = document.querySelector('#catalog');
  const results = document.querySelector('#results');
  const format = new Intl.NumberFormat();
  let pending;

  async function show(runId) {
    pending?.abort();
    pending = new AbortController();
    const {signal} = pending;
    results.hidden = true;
    status.textContent = 'Reading recorded evidence…';
    try {
      const report = await loadCoverage(read, runId, {signal, onProgress: count => {
        if (!signal.aborted) status.textContent = `Checked ${format.format(count)} records…`;
      }});
      if (signal.aborted) return;
      const {totals, run, descriptive, rows, sources} = report;
      const ratio = (count, total) => `${format.format(count)} / ${format.format(total)}`;
      document.querySelector('#model').textContent = `${run.context.modelVersion} · ${run.status} · revision ${run.revision}`;
      const columns = row => [format.format(row.total), ratio(row.linked, row.total),
        format.format(row.unlinked), format.format(row.unknown), ratio(row.withEvidence, row.total),
        format.format(row.evidenceUnknown), ratio(row.withProvenance, row.total)];
      renderRows(document.querySelector('#breakdown'), rows.map(row => [
        row.domain, row.kind === 'events' ? 'Event' : 'Observation', row.type, ...columns(row)
      ]));
      renderRows(document.querySelector('#total'), [['All records', '—', '—', ...columns(totals)]]);
      renderRows(document.querySelector('#sources'), sources.map(source => [
        source.source, source.kind, source.modelVersion, format.format(source.count)
      ]));
      document.querySelector('#source-table').hidden = !sources.length;
      document.querySelector('#no-sources').hidden = Boolean(sources.length);
      document.querySelector('#excluded').textContent =
        `Excluded ${format.format(descriptive)} explicitly descriptive events from the denominator.`;
      status.textContent = totals.total ? 'Coverage loaded.' : 'This run has no eligible stored events or observations.';
      results.hidden = false;
    } catch (error) {
      if (!signal.aborted) status.textContent = error.message;
    }
  }

  function addRun(id, label = id) {
    if (![...select.options].some(option => option.value === id)) select.add(new Option(label, id));
  }

  const requested = new URL(location.href).searchParams.get('runId');
  if (requested) {
    addRun(requested);
    select.value = requested;
    void show(requested);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!select.value) return;
    const url = new URL(location.href);
    url.searchParams.set('runId', select.value);
    history.replaceState(null, '', url);
    void show(select.value);
  });

  (async () => {
    try {
      for await (const runs of listCoverageRuns(read)) {
        for (const run of runs) addRun(run.id, `${run.id} · ${run.status}`);
      }
      catalog.hidden = select.options.length > 1;
      catalog.textContent = 'No recorded runs are available. The causal history demo can create a sample run.';
    } catch (error) {
      catalog.hidden = false;
      catalog.textContent = error.message;
    }
  })();
}

if (typeof document !== 'undefined') mount();
