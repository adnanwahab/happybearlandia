const ballot = document.querySelector('#ballot');
const status = document.querySelector('#status');
const suggestionStatus = document.querySelector('#suggestion-status');
const suggestionForm = document.querySelector('#suggestion-form');
let busy = false;
async function api(path, data) {
  const options = data === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
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
    const disabled = busy || !item.open || !votingEnabled;
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
  suggestionForm.querySelector('button').disabled = !votingEnabled;
}
let last = { patches: [], votingEnabled: false };
async function refresh() {
  try { last = await api('/api/patch-votes'); display(last.patches, last.votingEnabled); }
  catch (error) { status.textContent = error.message; }
}
async function vote(item, value) {
  if (busy) return; busy = true; display(last.patches, last.votingEnabled);
  try {
    const result = await api('/api/patch-votes/' + encodeURIComponent(item.id) + '/vote', { value });
    last.patches = result.patches; status.textContent = 'Your vote was recorded.';
  } catch (error) { status.textContent = error.message; }
  finally { busy = false; display(last.patches, last.votingEnabled); }
}
suggestionForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true; suggestionForm.querySelector('button').disabled = true;
  try {
    const form = new FormData(suggestionForm);
    const response = await api('/api/patch-votes/suggestions', {
      title: String(form.get('title') || ''),
      details: String(form.get('details') || '')
    });
    suggestionStatus.textContent = response.message; suggestionForm.reset();
  } catch (error) { suggestionStatus.textContent = error.message; }
  finally { busy = false; suggestionForm.querySelector('button').disabled = !last.votingEnabled; }
});
refresh();
