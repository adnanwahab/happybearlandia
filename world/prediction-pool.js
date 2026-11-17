const panel = document.querySelector('#prediction-pool');
panel.innerHTML = `<h2>Prediction Pool · local rehearsal</h2><p>Private, temporary group forecasts of synthetic City outcomes. One matched run, no performance ranking. Expires after one hour; restart deletes all pools. Share only with consent. Anyone holding a capability can use it.</p>
<form id="pool-create"><label>Seed <input name="seed" type="number" min="0" max="4294967295" value="2911" required></label><label>Months <input name="months" type="number" min="1" max="36" value="12" required></label><label>Run <select name="policy"><option value="transit-d1-8">Riverside transit capacity +8</option><option value="housing-d1-3">Riverside housing +3</option></select></label><label>Metric <select name="metric"><option value="meanCommuteMinutes">Mean commute change (minutes)</option><option value="housingUnits">Housing units change</option></select></label><button>Create private pool</button></form>
<form id="pool-commit" hidden><label>Forecast type <select name="direction"><option value="">Numeric change</option><option value="down">Down</option><option value="same">Unchanged</option><option value="up">Up</option></select></label><label>Numeric change <input name="expected" type="number" step="any" value="0" required></label><button>Commit privately</button></form>
<button id="pool-read" hidden>Refresh pool</button> <button id="pool-reveal" hidden>Lock and compute outcome</button> <button id="pool-delete" hidden>Delete my participation / host pool</button><p id="pool-status" role="status"></p><pre id="pool-result" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>`;
const el = id => document.getElementById(id);
let session;
const status = el('pool-status');
async function call(action, extra = {}) {
  const response = await fetch('/api/prediction-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...session, action, ...extra }) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error);
  return value;
}
function show(value) {
  status.textContent = `${value.state}: ${value.committed}/${value.members} committed. Metric: ${value.metric}. Seed ${value.plan.seed}, ${value.plan.months} months. Expires ${new Date(value.expires).toLocaleString()}.`;
  el('pool-create').hidden = true;
  el('pool-commit').hidden = session.host || value.ownCommitted || value.state !== 'open';
  for (const id of ['pool-read', 'pool-delete']) el(id).hidden = false;
  el('pool-reveal').hidden = !session.host || value.state !== 'open';
  if (value.state !== 'open') el('pool-result').textContent = value.state === 'revealed' ? JSON.stringify(value, null, 2) : 'Run unavailable. No scores or ranking.';
}
async function safely(fn) { try { await fn(); } catch (error) { status.textContent = error.message; } }
el('pool-create').onsubmit = event => { event.preventDefault(); safely(async () => {
  const fields = new FormData(event.target);
  const value = await call('create', { plan: { seed: Number(fields.get('seed')), months: Number(fields.get('months')), policies: [fields.get('policy')] }, metric: fields.get('metric') });
  session = { id: value.id, key: value.host, host: true };
  const link = new URL(location.href); link.hash = new URLSearchParams({ pool: value.id, invite: value.invite });
  el('pool-result').textContent = `Opt-in invite (expires in one hour; copy manually): ${link}`;
  show(await call('read'));
}); };
el('pool-commit').onsubmit = event => { event.preventDefault(); safely(async () => {
  const fields = new FormData(event.target);
  show(await call('commit', { direction: fields.get('direction'), expected: Number(fields.get('expected')) }));
}); };
for (const [id, action] of [['pool-read', 'read'], ['pool-reveal', 'reveal'], ['pool-delete', 'delete']]) el(id).onclick = () => safely(async () => {
  const value = await call(action);
  if (action === 'delete') { session = undefined; location.reload(); } else show(value);
});
const invite = new URLSearchParams(location.hash.slice(1));
if (invite.has('pool')) safely(async () => {
  const id = invite.get('pool');
  const value = await call('join', { id, invite: invite.get('invite') });
  session = { id, key: value.member };
  history.replaceState(null, '', location.pathname);
  show(await call('read'));
});
