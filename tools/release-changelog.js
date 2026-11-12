// Pure public contract, also exported through ops/changelog.js for offline review.
export const MAX_BYTES = 65536;
const repo = 'https://github.com/adnanwahab/happybearlandia/';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z');
const keys = (v, names) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === names.split(' ').sort().join();
export function verifiedEntry(e) {
  if (!keys(e, 'title summary pr deployment')) return false;
  const p = e.pr, d = e.deployment;
  return text(e.title, 120) && text(e.summary, 600) &&
    keys(p, 'number mergedAt mergeCommit url') && Number.isSafeInteger(p.number) && p.number > 0 && p.number <= 1000000000 &&
    date(p.mergedAt) && sha(p.mergeCommit) && p.url === `${repo}pull/${p.number}` &&
    keys(d, 'version deployedAt commit versionUrl evidenceUrl verified') && d.verified === true &&
    sha(d.commit) && d.commit === p.mergeCommit && d.version === d.commit &&
    d.versionUrl === `${repo}commit/${d.commit}` &&
    typeof d.evidenceUrl === 'string' && d.evidenceUrl.startsWith(repo) && /^actions\/runs\/[1-9][0-9]{0,19}$/.test(d.evidenceUrl.slice(repo.length)) &&
    date(d.deployedAt) && d.deployedAt >= p.mergedAt;
}
export function parseChangelog(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Invalid manifest size');
  const manifest = JSON.parse(raw);
  if (!keys(manifest, 'schemaVersion entries') || manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length > 100) throw new Error('Invalid manifest');
  const entries = manifest.entries.filter(verifiedEntry);
  // Ambiguous duplicate releases invalidate the manifest rather than hiding evidence.
  if (new Set(entries.map(e => e.deployment.version)).size !== entries.length) throw new Error('Duplicate version');
  return entries.sort((a,b) => b.deployment.deployedAt.localeCompare(a.deployment.deployedAt));
}

export async function loadChangelog(root) {
  const status = root.querySelector('[role="status"]');
  const list = root.querySelector('ol');
  list.replaceChildren();
  status.textContent = 'Loading release evidence…';
  try {
    const response = await fetch('/data/changelog.json', {cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Unavailable');
    // Bound streamed bytes before decoding/parsing, even without Content-Length.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let raw = '', bytes = 0;
    try {
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw new Error('Too large');
        raw += decoder.decode(value, {stream:true});
      }
      raw += decoder.decode();
    } finally { await reader.cancel(); }
    const entries = parseChangelog(raw);
    status.textContent = entries.length ? `${entries.length} verified release${entries.length === 1 ? '' : 's'}.` : 'No verified deployed releases yet. Release notes will appear when merged PR and exact deployment evidence have been reviewed.';
    for (const e of entries) {
      const item = document.createElement('li');
      const heading = document.createElement('h2'); heading.textContent = e.title;
      const summary = document.createElement('p'); summary.textContent = e.summary;
      const time = document.createElement('time'); time.dateTime = e.deployment.deployedAt; time.textContent = `Deployed ${e.deployment.deployedAt.slice(0,10)}`;
      item.append(heading, summary, time);
      for (const [label,url] of [[`Merged PR #${e.pr.number}`,e.pr.url],[`Deployed version ${e.deployment.version}`,e.deployment.versionUrl],['Deployment evidence',e.deployment.evidenceUrl]]) {
        const link = document.createElement('a'); link.textContent = label; link.href = url; item.append(link);
      }
      list.append(item);
    }
  } catch {
    list.replaceChildren();
    status.textContent = 'Release notes unavailable. Evidence could not be loaded or validated. Please try again later.';
  }
}
if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-changelog]');
  if (root) loadChangelog(root);
}
