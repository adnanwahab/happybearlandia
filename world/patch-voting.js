// Restore the exact World scenario when returning from the patch ballot.
const returnTo = new URLSearchParams(location.search).get('returnTo');
if (returnTo && returnTo.startsWith('/world') && !returnTo.startsWith('//') && !/[\\\r\n]/.test(returnTo)) {
  const back = document.querySelector('a.back');
  if (back) { back.href = returnTo; back.textContent = '← Back to your world'; }
}
const worldContext = (() => {
  const target = new URLSearchParams(location.search).get('returnTo');
  if (!target || !target.startsWith('/world') || target.startsWith('//')) return null;
  const url = new URL(target, location.origin);
  const keys = ['universeId', 'worldId', 'scenarioId', 'seed'];
  const result = {};
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value && value.length <= 128 && /^[A-Za-z0-9:_.-]+$/.test(value)) result[key] = value;
  }
  return Object.keys(result).length ? result : null;
})();
const worldContextLabel = document.querySelector('#patch-world-context');
if (worldContextLabel) worldContextLabel.textContent = worldContext?.scenarioId
  ? 'Your suggestion will reference scenario ' + worldContext.scenarioId + '.'
  : 'Your suggestion can describe the world or feature you want improved.';

const consent = document.querySelector('#consent');
const ballot = document.querySelector('#ballot');
const status = document.querySelector('#status');
const suggestionStatus = document.querySelector('#suggestion-status');
const suggestionForm = document.querySelector('#suggestion-form');
let busy = false;
async function api(path, data) {
  const options = data === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...data, consent: consent.checked })
  };
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(text, pressed, disabled, onClick) {
  const btn = node('button', text);
  btn.type = 'button'; btn.setAttribute('aria-pressed', String(pressed));
  btn.disabled = disabled; btn.addEventListener('click', onClick); return btn;
}
async function showImpact(id, target) {
  target.hidden = false;
  target.replaceChildren(node('p', 'Loading recorded comparison…'));
  try {
    const response = await fetch('/api/patches/' + encodeURIComponent(id) + '/impact');
    if (!response.ok) throw new Error('Impact lookup failed (' + response.status + ').');
    const evidence = await response.json();
    if (evidence.available === false) {
      target.replaceChildren(node('p', evidence.reason, 'muted'));
      return;
    }
    const provenance = node('p', 'Recorded model comparison · Seed ' + evidence.seed +
      ' · Scenario ' + evidence.scenarioId + ' · ' + new Date(evidence.recordedAt).toLocaleDateString(), 'impact-provenance');
    const table = node('table');
    const heading = node('tr');
    for (const title of ['Metric', 'Before', 'After', 'Change']) heading.append(node('th', title));
    table.append(heading);
    for (const row of evidence.metrics) {
      const tr = node('tr');
      const fmt = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
      for (const value of [row.label, fmt(row.before) + ' ' + row.unit,
        fmt(row.after) + ' ' + row.unit, (row.delta > 0 ? '+' : '') + fmt(row.delta) + ' ' + row.unit]) tr.append(node('td', value));
      table.append(tr);
    }
    const trace = node('p', 'Before: ' + evidence.before.runId + ' (' + evidence.before.rulesVersion +
      ') · After: ' + evidence.after.runId + ' (' + evidence.after.rulesVersion + ')', 'impact-provenance');
    target.replaceChildren(provenance, table, trace, node('p', evidence.caveat, 'muted'));
  } catch (error) {
    target.replaceChildren(node('p', error.message, 'muted'));
  }
}
function display(items, votingEnabled) {
  ballot.replaceChildren();
  for (const item of items) {
    const card = node('article', null, 'patch');
    const meta = node('div', null, 'meta');
    meta.append(node('span', item.cadence === 'daily' ? 'Daily patch' : 'Weekly patch'), node('span', item.area));
    card.append(meta, node('h3', item.title), node('p', item.summary));
    const actions = node('div', null, 'vote-actions');
    const disabled = busy || !consent.checked || !item.open || !votingEnabled;
    actions.append(
      button('👍', item.yourVote === 1, disabled, () => vote(item, item.yourVote === 1 ? 0 : 1)),
      button('👎', item.yourVote === -1, disabled, () => vote(item, item.yourVote === -1 ? 0 : -1)),
      node('span', item.score + ' net votes')
    );
    const end = node('small', item.open ? 'Voting ends ' + new Date(item.closesAt).toLocaleString() : 'Voting closed');
    const threshold = node('div', null, 'threshold');
    threshold.append(node('span', Math.max(0, item.upvotes) + ' / 5 upvotes toward the configured minimum'));
    const progress = node('progress');
    progress.max = 5;
    progress.value = Math.min(5, Math.max(0, item.upvotes));
    progress.setAttribute('aria-label', 'Votes toward the five-upvote minimum');
    threshold.append(progress);
    const lifecycle = node('div', null, 'patch-lifecycle');
    if (item.github) {
      const state = item.github.status === 'merged' ? 'Merged · deployment not verified'
        : item.github.status === 'draft' ? 'Draft PR · awaiting review'
        : item.github.status === 'closed' ? 'PR closed' : 'Ready PR · CI and reviews required';
      const anchor = node('a', '#' + item.github.prNumber + ' · ' + state);
      anchor.href = item.github.prUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      lifecycle.append(anchor, node('span', 'Core CI: ' + item.github.ciStatus));
    } else {
      lifecycle.append(node('small', item.open ? 'Community ballot open'
        : 'Ballot closed · awaiting maintainer eligibility checks'));
    }
    const compare = node('button', '↔ Compare impact');
    compare.type = 'button';
    compare.setAttribute('aria-expanded', 'false');
    const comparison = node('div', null, 'impact-result');
    comparison.hidden = true;
    compare.addEventListener('click', () => {
      const open = comparison.hidden;
      comparison.hidden = !open;
      compare.setAttribute('aria-expanded', String(open));
      if (open) showImpact(item.id, comparison);
    });
    card.append(actions, threshold, end, lifecycle, compare, comparison);
    ballot.append(card);
  }
  status.textContent = votingEnabled
    ? 'Choose as many patches as you like. You may change or withdraw each vote.'
    : 'Voting is not configured on this server yet. You can still view the patch ballot.';
  suggestionForm.querySelector('button').disabled = busy || !votingEnabled || !consent.checked;
}
let last = { patches: [], votingEnabled: false };
async function refresh() {
  try { last = await api('/api/patch-votes'); display(last.patches, last.votingEnabled); }
  catch (error) { status.textContent = error.message; }
}
async function vote(item, value) {
  if (busy || !consent.checked) return; busy = true; display(last.patches, last.votingEnabled);
  let message;
  try {
    const result = await api('/api/patch-votes/' + encodeURIComponent(item.id) + '/vote', { value });
    last.patches = result.patches; message = 'Your vote was recorded.';
  } catch (error) { message = error.message; }
  finally { busy = false; display(last.patches, last.votingEnabled); status.textContent = message; }
}
suggestionForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !consent.checked) return;
  busy = true; suggestionForm.querySelector('button').disabled = true;
  try {
    const form = new FormData(suggestionForm);
    const response = await api('/api/patch-votes/suggestions', {
      title: String(form.get('title') || ''),
      details: String(form.get('details') || ''),
      kind: form.get('kind'), replaySeed: form.get('kind') === 'problem' && form.get('replaySeed') ? String(form.get('replaySeed')) : null,
      worldContext
    });
    suggestionStatus.textContent = response.message; suggestionForm.reset(); document.querySelector('#replay-seed').disabled = true;
  } catch (error) { suggestionStatus.textContent = error.message; }
  finally { busy = false; suggestionForm.querySelector('button').disabled = !last.votingEnabled || !consent.checked; }
});
consent.addEventListener('change', () => display(last.patches, last.votingEnabled));
document.querySelector('#kind').addEventListener('change', event => {
  document.querySelector('#replay-seed').disabled = event.target.value !== 'problem';
});
refresh();
