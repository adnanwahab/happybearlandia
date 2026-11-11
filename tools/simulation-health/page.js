const find = id => document.getElementById(id);
const button = document.querySelector('button');

async function probe(path) {
  const start = performance.now();
  try {
    const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return { data: await response.json(), elapsed: Math.round(performance.now() - start) };
  } catch {
    return { data: null, elapsed: null };
  }
}

const availability = state => state === 'ok' ? 'Available' : state === 'unavailable' ? 'Unavailable' : 'Unknown';
function describe(probe, label) {
  return probe.data ? `${label} · ${probe.elapsed} ms` : 'No response';
}

async function refresh() {
  button.disabled = true;
  find('status').textContent = 'Checking the server…';
  const [live, ready] = await Promise.all([probe('/api/health'), probe('/api/ready')]);
  find('build').textContent = live.data?.buildId ?? ready.data?.buildId ?? 'Unknown';
  find('live').textContent = describe(live, availability(live.data?.status));
  find('ready').textContent = describe(ready, ready.data?.status === 'ready' ? 'Ready' : 'Unavailable');
  find('world').textContent = availability(ready.data?.checks?.worldStorage);
  find('decision').textContent = availability(ready.data?.checks?.decisionStorage);
  find('status').textContent = live.data && ready.data && live.data.buildId !== ready.data.buildId
    ? 'The probes reached different builds. Refresh to check again.'
    : 'Checks updated.';
  button.disabled = false;
}
button.addEventListener('click', refresh);
void refresh();
