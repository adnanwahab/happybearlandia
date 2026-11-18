import { BLOCKS, DEMO, runCommander, replayCommander, schedule } from './commander.js';
const byId = id => document.getElementById(id);
const control = id => /** @type {HTMLInputElement | HTMLButtonElement} */ (byId(id));
const stepInput = () => /** @type {HTMLInputElement} */ (byId('step'));
let record, controller, timer;
for (const block of BLOCKS) {
  const label = document.createElement('label');
  label.textContent = block.name + ' ';
  const select = document.createElement('select');
  select.name = block.id;
  for (const mode of ['skip', 'standard', 'express']) select.add(new Option(mode, mode));
  label.append(select); byId('choices').append(label);
}
const selects = [...document.querySelectorAll('select')];
const plan = () => selects.map(select => select.value);
function stop() { clearInterval(timer); timer = undefined; byId('play').textContent = 'Play recorded steps'; }
function clear() {
  stop(); record = undefined;
  byId('results').textContent = byId('receipt').textContent = byId('frame').textContent = '';
  for (const id of ['replay', 'step', 'play']) control(id).disabled = true;
}
function preview() {
  controller?.abort(); controller = undefined; clear();
  control('cancel').disabled = true;
  byId('status').textContent = 'Draft changed. Run to score.';
  try {
    const dispatch = schedule(plan());
    byId('cost').textContent = `${dispatch.cost.toLocaleString()} illustrative USD · ` + dispatch.jobs.map(job =>
      `${job.block}: ${job.mode === 'skip' ? 'skipped' : `shift ${job.completedShift}, ${job.installed ? 'installed' : 'too late'}`}`).join('; ');
  } catch (error) { byId('cost').textContent = error.message; }
}
function frame() {
  if (!record) return;
  const step = Number(stepInput().value);
  byId('frame').textContent = `Recorded step ${step} · ` + BLOCKS.map((block, index) =>
    `${block.name}: ${record.baseline.depths[step][index].toFixed(4)} → ${record.adjusted.depths[step][index].toFixed(4)} m peak footprint depth`).join('; ');
}
async function execute(replay = false) {
  const previous = record;
  controller?.abort(); const active = new AbortController(); controller = active;
  clear(); control('cancel').disabled = false;
  byId('status').textContent = 'Running pinned matched storm on CPU…';
  try {
    const result = replay ? await replayCommander(previous, { signal: active.signal }) : await runCommander(plan(), { signal: active.signal });
    if (controller !== active) return;
    record = result;
    byId('status').textContent = `${replay ? 'Replay verified. ' : ''}${record.success ? 'Success' : 'Challenge failed'}: ${record.protectedBlocks}/3 blocks stayed dry. Synthetic modeled result; uncertainty unquantified.`;
    byId('results').textContent = record.adjusted.parcels.map((row, index) =>
      `${BLOCKS[index].name}: ${record.baseline.parcels[index].floodedTicks} → ${row.floodedTicks} flooded steps`).join('; ');
    byId('receipt').textContent = JSON.stringify(record, null, 2);
    for (const id of ['replay', 'step', 'play']) control(id).disabled = false;
    stepInput().value = '0'; frame();
  } catch (error) {
    if (controller === active) { clear(); byId('status').textContent = `${error.message} No result scored.`; }
  } finally { if (controller === active) control('cancel').disabled = true; }
}
byId('plan').onsubmit = event => { event.preventDefault(); execute(); };
byId('plan').onchange = preview;
byId('demo').onclick = () => { selects.forEach((select, index) => select.value = DEMO[index]); preview(); };
byId('cancel').onclick = () => { controller?.abort(); clear(); byId('status').textContent = 'Cancelled. No result scored.'; };
byId('replay').onclick = () => execute(true);
byId('step').oninput = frame;
byId('play').onclick = () => {
  if (timer) return stop();
  if (Number(stepInput().value) === 60) stepInput().value = '0';
  byId('play').textContent = 'Pause recorded steps';
  timer = setInterval(() => { stepInput().value = String(Number(stepInput().value) + 1); frame(); if (Number(stepInput().value) === 60) stop(); }, 500);
};
addEventListener('pagehide', () => { controller?.abort(); stop(); });
preview();
