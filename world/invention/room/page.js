import { rooms } from './store.js';
import { POLICY_CATALOG } from '../model.js';
import { proposalLabel } from './model.js';
const $ = id => document.getElementById(id);
let session = null, current = null;
const selected = new Set();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('hbl-proposal-refresh') : null;
for (const policy of POLICY_CATALOG) {
  const option = document.createElement('option'); option.value = policy.id;
  option.textContent = `${policy.label} · ${policy.cost} illustrative USD`; $('policy').append(option);
}
function render(room) {
  current = room;
  $('entry').hidden = true; $('canvas').hidden = false;
  $('identity').textContent = `Room ${session.id} · ${session.name} (${room.isOwner ? 'owner' : 'guest'}) · revision ${room.revision}`;
  const b = room.blueprint;
  $('source').textContent = `Synthetic Riverside fixture ${b.scenarioVersion}; City ${b.modelVersion}; seed ${b.source.seed}; start month ${b.source.startMonth}; horizon ${b.source.months} months. Exact parcel-d0/d1/d2 district mapping; catalog cost assumptions. No simulation has run in this room.`;
  $('proposals').replaceChildren();
  for (const row of room.proposals) {
    const label = document.createElement('label'); const input = document.createElement('input');
    input.type = 'checkbox'; input.value = row.id; input.checked = selected.has(row.id); input.disabled = !room.isOwner;
    input.addEventListener('change', () => { input.checked ? selected.add(row.id) : selected.delete(row.id); $('submit').disabled = true; $('summary').textContent = 'Selection changed. Review again.'; });
    label.append(input, document.createTextNode(proposalLabel(row))); $('proposals').append(label);
  }
  $('comments').replaceChildren(...room.comments.map(row => { const li = document.createElement('li'); li.textContent = `${row.author}: ${row.text}`; return li; }));
  $('review').disabled = $('delete').disabled = !room.isOwner;
  const reviewed = room.review && JSON.stringify([...selected].sort()) === JSON.stringify([...room.review.ids].sort());
  $('submit').disabled = !room.isOwner || !reviewed;
  $('summary').textContent = reviewed ? `Reviewed revision ${room.revision}:\n${room.review.ids.map(id => proposalLabel(room.proposals.find(row => row.id === id))).join('\n') || 'No policy changes'}\nConfirm opens a recomputed future using these pinned inputs. Original runs remain unchanged.` : 'Awaiting owner review.';
}
async function action(fn) {
  try { await fn(); } catch (error) { $('status').textContent = error.message; $('submit').disabled = true; }
}
async function refresh() {
  if (!session) return;
  try { render(await rooms.read(session.id, session.token)); }
  catch (error) { current = null; $('canvas').hidden = true; $('entry').hidden = false; $('status').textContent = error.message; }
}
async function change(command) {
  render(await rooms.change(session.id, session.token, command));
  channel?.postMessage(session.id); $('status').textContent = 'Draft saved locally. No simulation has run.';
}
$('entry').addEventListener('submit', event => { event.preventDefault(); action(async () => {
  if (!$('consent').checked) throw new Error('Opt in before storing drafts.');
  const id = $('room-id').value.trim(), name = $('name').value.trim(), token = crypto.randomUUID();
  const next = { id: id || crypto.randomUUID(), token, name };
  const room = await (id ? rooms.join(next.id, token, name) : rooms.create(next.id, token, name));
  session = next; sessionStorage.setItem('hbl-proposal-session', JSON.stringify(session)); render(room); channel?.postMessage(session.id);
}); });
$('propose').addEventListener('submit', event => { event.preventDefault(); action(() => {
  const policy = POLICY_CATALOG.find(row => row.id === $('policy').value);
  return change({ type: 'propose', edit: { parcelId: `parcel-${policy.districtId}`, policyId: policy.id } });
}); });
$('comment-form').addEventListener('submit', event => { event.preventDefault(); action(async () => { await change({ type: 'comment', text: $('comment').value }); $('comment').value = ''; }); });
$('review').addEventListener('click', () => action(() => change({ type: 'review', revision: current.revision, ids: [...selected] })));
$('submit').addEventListener('click', () => action(async () => { const url = await rooms.submit(session.id, session.token, current.revision); location.assign(url); }));
$('delete').addEventListener('click', () => action(async () => { await rooms.remove(session.id, session.token); channel?.postMessage(session.id); sessionStorage.removeItem('hbl-proposal-session'); session = null; $('canvas').hidden = true; $('entry').hidden = false; $('status').textContent = 'Local room and comments deleted. Already opened replay recipes are separate.'; }));
$('leave').addEventListener('click', () => { session = null; current = null; selected.clear(); $('canvas').hidden = true; $('entry').hidden = false; $('status').textContent = 'Drafts kept. Reload this tab to resume your stored local membership.'; });
channel?.addEventListener('message', () => refresh());
window.addEventListener('focus', refresh);
try { session = JSON.parse(sessionStorage.getItem('hbl-proposal-session') || 'null'); } catch { session = null; }
refresh();
