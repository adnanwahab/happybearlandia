import { authoredDemo } from './demo.js';
import { verifyQuest } from './model.js';
const $ = id => document.getElementById(id);
const source = /** @type {HTMLSelectElement} */ ($('source'));
const plan = /** @type {HTMLSelectElement} */ ($('plan'));
const run = /** @type {HTMLButtonElement} */ ($('run'));
const cancel = /** @type {HTMLButtonElement} */ ($('cancel'));
let quest, controller, generation = 0;
function clear() {
  generation++;
  controller?.abort(); controller = null;
  $('result').hidden = true;
  $('receipt').textContent = ''; $('outcome').textContent = ''; $('verdict').textContent = '';
  run.disabled = false; cancel.disabled = true; plan.disabled = false;
}
source.addEventListener('change', async () => {
  clear(); quest = null; $('quest').hidden = true; $('evidence').textContent = '';
  if (source.value !== 'demo') { $('status').textContent = 'No source data. No genuine resident/civic request log is connected.'; return; }
  const token = generation;
  $('status').textContent = 'Preparing pinned authored demo…';
  try {
    const ready = await authoredDemo(); if (token !== generation) return;
    quest = ready; $('quest').hidden = false;
    $('origin').textContent = `Origin: ${quest.origin.id} · revision ${quest.origin.revision} · ${quest.origin.sourceRef} · Authored demo, not a genuine logged request.`;
    $('request').textContent = quest.origin.text;
    $('terms').textContent = quest.winCondition;
    $('assumptions').textContent = `Seed ${quest.challenge.seed} · ${quest.challenge.engineVersion} · ${quest.schemaVersion}. ${quest.limitations} Capital excludes operating expense and private construction.`;
    $('evidence').textContent = JSON.stringify(quest, null, 2);
    $('status').textContent = 'Authored synthetic demo ready. Inspect the win condition before running.';
  } catch (error) { if (token === generation) $('status').textContent = `Quest unavailable: ${error.message}`; }
});
plan.addEventListener('change', () => { clear(); $('status').textContent = 'Plan changed. Run again for a new modeled result.'; });
cancel.addEventListener('click', () => { clear(); $('status').textContent = 'Run cancelled. No outcome claimed.'; });
run.addEventListener('click', async () => {
  if (!quest || controller) return;
  clear(); const token = generation; controller = new AbortController();
  run.disabled = true; cancel.disabled = false; plan.disabled = true;
  $('status').textContent = 'Recomputing matched futures from the same immutable checkpoint…';
  try {
    const receipt = await verifyQuest(quest, { selection: plan.value === 'housing' ? ['housing'] : [] }, { signal: controller.signal });
    if (token !== generation) return;
    $('result').hidden = false;
    $('verdict').textContent = receipt.result.won ? 'Modeled objective met' : receipt.result.status === 'metrics-unavailable' ? 'Outcome unavailable' : 'Objective not met';
    const metric = receipt.result.metrics[0];
    $('outcome').textContent = `Unhoused synthetic households: control ${metric.reference ?? 'unavailable'}; candidate ${metric.candidate ?? 'unavailable'}. ${receipt.interpretation}`;
    $('receipt').textContent = JSON.stringify(receipt, null, 2);
    $('status').textContent = 'Comparison complete. Inspect the modeled evidence below.';
  } catch (error) {
    if (token === generation) $('status').textContent = error.name === 'AbortError' ? 'Run cancelled. No outcome claimed.' : `Replay unavailable: ${error.message}`;
  } finally {
    if (token === generation) { controller = null; run.disabled = false; cancel.disabled = true; plan.disabled = false; }
  }
});
addEventListener('pagehide', clear);
