import { readGatherings, squareState, FILE_LIMIT } from './records.js';
const $ = id => document.getElementById(id);
let archive = null, revision = 0, disposed = false;
const listeners = new AbortController();
function render() {
  const fictional = $('mode').value === 'fictional';
  $('record-controls').hidden = fictional;
  $('tour-controls').hidden = !fictional;
  const at = Number($('minute').value);
  const scene = squareState(archive, Number($('event').value), at, fictional, $('title').value);
  $('scene-title').textContent = scene.title;
  $('status').textContent = scene.label;
  $('clock').textContent = `Minute ${at}`;
  $('receipt').textContent = scene.row ? `Event ID ${scene.row.id} · District ${scene.row.districtId} · [${scene.row.startMinute}, ${scene.row.endMinute}) simulation minutes · Source ${scene.row.source}` : '';
  $('provenance').textContent = fictional ? 'Player-authored fiction. No source event, seed or simulated timestamp.' : archive ? `culture.v1 · Seed ${archive.seed} · Snapshot minute ${archive.minute} · ${archive.records.length} retained gatherings` : 'No recorded source loaded.';
  $('square').dataset.view = $('view').value;
  $('crowd').replaceChildren(...Array.from({length: $('figures').checked ? scene.figures : 0}, () => {
    const figure = document.createElement('span'); figure.className = 'figure'; return figure;
  }));
}
function selectEvent() {
  const row = archive?.records[Number($('event').value)];
  $('minute').max = String(Math.max(1, archive?.minute ?? 0));
  $('minute').value = String(row?.startMinute ?? 0);
  render();
}
$('file').addEventListener('change', async () => {
  const current = ++revision;
  archive = null;
  $('event').replaceChildren(); $('event').disabled = true; $('minute').disabled = true;
  render();
  try {
    const file = $('file').files[0];
    if (!file) return;
    if (file.size > FILE_LIMIT) throw new Error('Snapshot exceeds the 1 MiB import limit.');
    const input = await file.text();
    if (disposed || current !== revision) return;
    archive = readGatherings(JSON.parse(input));
    $('event').replaceChildren(...archive.records.map((row,i) => new Option(`${row.title} · ${row.id}`, String(i))));
    $('event').disabled = !archive.records.length; $('minute').disabled = !archive.records.length;
    selectEvent();
  } catch (error) {
    if (!disposed && current === revision) { archive = null; render(); $('status').textContent = `Cannot open snapshot: ${error.message}`; }
  }
}, {signal: listeners.signal});
$('event').addEventListener('change', selectEvent, {signal:listeners.signal});
for (const id of ['mode','minute','title','view','figures']) $(id).addEventListener('input', render, {signal:listeners.signal});
window.addEventListener('pagehide', () => { disposed = true; revision++; archive = null; $('file').value = ''; listeners.abort(); $('crowd').replaceChildren(); }, {once:true});
// A back-forward cache restore gets a fresh controller and cannot retain stale imports.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
render();
