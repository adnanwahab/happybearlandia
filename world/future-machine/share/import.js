import { importReceiptText, readReceiptFile } from './import-receipt.js';
import { createShareURL } from './index.js';
const $ = id => document.getElementById(id);
const form = document.querySelector('form'), submit = form.querySelector('[type=submit]');
let controller = null, generation = 0;
function clearResult() { $('result').hidden = true; $('open').removeAttribute('href'); $('summary').textContent = ''; }
function busy(value) { submit.disabled = value; $('receipt').disabled = value; $('file').disabled = value; $('cancel').hidden = !value; }
function changed() { clearResult(); $('error').hidden = true; $('status').textContent = ''; }
$('receipt').addEventListener('input', changed);
$('file').addEventListener('change', changed);
$('cancel').addEventListener('click', () => { generation++; controller?.abort(); controller = null; busy(false); clearResult(); $('status').textContent = 'Verification cancelled.'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (controller) return;
  const token = ++generation; controller = new AbortController(); const signal = controller.signal;
  clearResult(); $('error').hidden = true; busy(true); $('status').textContent = 'Validating receipt and replaying the saved comparison…';
  try {
    const file = $('file').files[0];
    const text = file ? await readReceiptFile(file) : $('receipt').value;
    if (token !== generation) return;
    const {receipt, month} = await importReceiptText(text, {signal});
    if (token !== generation) return;
    const {recipe, experimentId, seed, modelVersion} = receipt.evidence;
    $('open').href = createShareURL({recipe, experimentId, month}, new URL('/world/future-machine.html', location.origin));
    $('summary').textContent = `Saved run ${experimentId} · seed ${seed} · model ${modelVersion} · month ${month}. Selected and terminal outcome hashes match the receipt. The comparison reopens from this saved recipe; it is not a new independent observation.`;
    $('result').hidden = false; $('status').textContent = 'Receipt and saved replay verified.';
  } catch (error) {
    if (token !== generation) return;
    $('status').textContent = 'No comparison opened.';
    $('error').textContent = error?.name === 'AbortError' ? 'Verification was cancelled or timed out. Try again.' : error.message;
    $('error').hidden = false;
  } finally { if (token === generation) { controller = null; busy(false); } }
});
addEventListener('pagehide', () => controller?.abort());
