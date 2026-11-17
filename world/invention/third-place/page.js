import { SCENARIO, PROJECTS, compareProject, replayComparison } from './model.js';
const $ = id => document.getElementById(id);
const project = /** @type {HTMLSelectElement} */ ($('project'));
const receipt = /** @type {HTMLTextAreaElement} */ ($('receipt'));
const confirm = /** @type {HTMLButtonElement} */ ($('confirm'));
const before = /** @type {HTMLButtonElement} */ ($('before'));
const after = /** @type {HTMLButtonElement} */ ($('after'));
let source = SCENARIO, committed = null;
function preview() {
  const p = PROJECTS[project.value];
  $('preview').textContent = `${p.areaM2} m² · Capital ${p.capitalUSD.toLocaleString('en-US')} + annual upkeep ${p.annualUpkeepUSD.toLocaleString('en-US')} = first-year ${ (p.capitalUSD + p.annualUpkeepUSD).toLocaleString('en-US')} illustrative USD. Authored assumptions; immediate delivery assumed.`;
  confirm.disabled = !source;
}
function show(which) {
  if (!committed) return;
  $('checkpoint').textContent = JSON.stringify(committed[which], null, 2);
  $('lot').textContent = `${which === 'before' ? 'Empty lot' : PROJECTS[committed.project].label} · authored schematic · ${which} design checkpoint`;
}
function accept(result) {
  committed = result;
  before.disabled = after.disabled = false;
  receipt.value = JSON.stringify(result, null, 2);
  show('after');
}
project.onchange = preview;
$('design').onsubmit = event => {
  event.preventDefault();
  try { accept(compareProject(project.value, source)); $('status').textContent = 'Design challenge passed: permitted and within budget. Social success unavailable.'; }
  catch (error) { $('status').textContent = error.message; }
};
$('cancel').onclick = () => {
  project.value = committed?.project || 'park'; preview();
  $('status').textContent = 'Draft canceled. Confirmed checkpoints unchanged.';
};
$('clear').onclick = () => { source = null; preview(); $('status').textContent = 'No source data. Load the pinned authored demo. Existing checkpoints retained.'; };
$('demo').onclick = () => { source = SCENARIO; preview(); $('status').textContent = 'Pinned demo loaded. Confirm to create a comparison.'; };
before.onclick = () => show('before');
after.onclick = () => show('after');
$('replay').onclick = () => {
  try { const result = replayComparison(receipt.value); accept(result); project.value = result.project; preview(); $('status').textContent = 'Design replay verified against supplied checkpoints. No social results available.'; }
  catch (error) { $('status').textContent = error.message + ' Previous confirmed checkpoints unchanged.'; }
};
preview();
