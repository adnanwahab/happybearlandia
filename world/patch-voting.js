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
    card.append(actions, end);
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
      kind: form.get('kind'), replaySeed: form.get('kind') === 'problem' && form.get('replaySeed') ? String(form.get('replaySeed')) : null
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
