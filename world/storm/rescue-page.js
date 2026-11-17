const get = id => document.getElementById(id);
let revision;
async function call(method, body, create = false) {
  try {
    const response = await fetch('/api/storm/rescue' + (create ? '' : '/' + encodeURIComponent(get('room').value)), {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + get('key').value },
      ...(body && { body: JSON.stringify({ ...body, revision }) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (create) {
      get('room').value = data.id;
      get('keys').textContent = `Room: ${data.id}\nCrew key: ${data.crew}\nBudget key: ${data.budget}\nCopy privately; keys are not saved by this page.`;
    }
    revision = data.revision;
    get('result').textContent = JSON.stringify(data, null, 2);
    get('status').textContent = data.deleted ? 'Room deleted. Previously copied receipts cannot be revoked.' : data.receipt ? 'Committed. Receipt includes matched inputs, modeled outcomes and replay plan.' : 'Draft only; outcome unknown. Refresh before proposing if your friend changed the plan.';
    if (data.deleted) { get('keys').textContent = ''; get('key').value = ''; }
  } catch (error) { get('status').textContent = error.message; get('result').textContent = ''; }
}
get('create').onclick = () => call('POST', {}, true);
get('refresh').onclick = () => call('GET');
get('crew').onclick = () => call('POST', { action: 'propose', value: get('resources').value });
get('budget').onclick = () => call('POST', { action: 'propose', value: get('timing').value });
get('commit').onclick = () => call('POST', { action: 'commit' });
get('delete').onclick = () => call('DELETE');

get('replay').onclick = () => call('POST', { action: 'replay' });
