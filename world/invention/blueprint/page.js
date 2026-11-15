import { POLICY_CATALOG, futureURL } from '../model.js';
import { PALETTES, PARCELS, createBlueprint, encodeBlueprint, blueprintPlan, previewImport, confirmImport } from './model.js';
const $ = id => document.getElementById(id);
const payload = /** @type {HTMLTextAreaElement} */ ($('payload'));
const output = /** @type {HTMLTextAreaElement} */ ($('output'));
const confirm = /** @type {HTMLButtonElement} */ ($('confirm'));
const replay = /** @type {HTMLAnchorElement} */ ($('replay'));
const download = /** @type {HTMLAnchorElement} */ ($('download'));
const paletteInput = parcelId => /** @type {HTMLSelectElement} */ ($(parcelId + '-palette'));
let current = createBlueprint();
let pending = null;
let downloadURL;
const groups = [];
function option(label, value) {
  const node = document.createElement('option'); node.textContent = label; node.value = value; return node;
}
for (const parcelId of PARCELS) {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend'); legend.textContent = parcelId; fieldset.append(legend);
  for (const type of ['transit', 'housing', 'upzone']) {
    const label = document.createElement('label'); label.textContent = type;
    const select = document.createElement('select'); select.id = `${parcelId}-${type}`;
    select.add(option('No proposal', ''));
    for (const policy of POLICY_CATALOG.filter(row => `parcel-${row.districtId}` === parcelId && row.type === type)) {
      select.add(option(`${policy.label} · ${policy.cost} USD proposed`, policy.id));
    }
    label.append(select); fieldset.append(label); groups.push({ select, parcelId, type });
  }
  const label = document.createElement('label'); label.textContent = 'Cosmetic palette';
  const select = document.createElement('select'); select.id = `${parcelId}-palette`;
  for (const palette of PALETTES) select.add(option(palette, palette));
  label.append(select); fieldset.append(label); $('choices').append(fieldset);
}
function invalidate() {
  pending = null; confirm.disabled = true; $('preview-result').replaceChildren();
}
function render() {
  output.value = ''; download.hidden = true;
  if (downloadURL) { URL.revokeObjectURL(downloadURL); downloadURL = undefined; }
  $('swatches').replaceChildren(...current.cosmetics.map(choice => cosmeticSwatch(choice)));

  for (const { select, parcelId, type } of groups) {
    select.value = current.edits.find(row => row.parcelId === parcelId && row.policyId.startsWith(type + '-'))?.policyId ?? '';
  }
  for (const parcel of PARCELS) paletteInput(parcel).value = current.cosmetics.find(row => row.parcelId === parcel)?.palette ?? 'natural';
  $('receipt').textContent = `Synthetic source: ${current.scenarioVersion}; model ${current.modelVersion}; seed ${current.source.seed}; start month 2; horizon ${current.source.months} months. ${current.edits.length} policy edits.`;
  replay.href = futureURL(blueprintPlan(current));
}
function cosmeticSwatch(choice) {
  const row = document.createElement('p'); row.className = 'palette'; row.dataset.palette = choice.palette;
  row.textContent = `${choice.parcelId}: ${choice.palette} cosmetic palette`; return row;
}
function summary(blueprint) {
  const box = $('preview-result'); box.replaceChildren();
  const p = document.createElement('p');
  p.textContent = `Replace with ${blueprint.edits.length} policy edits; seed ${blueprint.source.seed}; ${blueprint.source.months} months; ${blueprint.modelVersion}; ${blueprint.scenarioVersion}. Cosmetics do not affect replay.`; box.append(p);
  for (const edit of blueprint.edits) {
    const row = document.createElement('p'); row.textContent = `${edit.parcelId}: ${POLICY_CATALOG.find(policy => policy.id === edit.policyId).label}`; box.append(row);
  }
  for (const choice of blueprint.cosmetics) {
    box.append(cosmeticSwatch(choice));
  }
}
$('editor').addEventListener('submit', event => {
  event.preventDefault();
  try {
    current = createBlueprint({ ...blueprintPlan(current), policies: groups.map(({ select }) => select.value).filter(Boolean) }, PARCELS.map(parcelId => ({ parcelId, palette: paletteInput(parcelId).value })));
    invalidate(); render(); $('status').textContent = 'Session design updated. No simulation has run.';
  } catch (error) { $('status').textContent = error.message; }
});
payload.addEventListener('input', invalidate);
$('export').addEventListener('click', () => {
  const text = encodeBlueprint(current); output.value = text; download.hidden = true;
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  if (typeof URL.createObjectURL === 'function') {
    downloadURL = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    download.href = downloadURL; download.hidden = false;
  }
  $('status').textContent = 'Blueprint exported. Copy the JSON' + (download.hidden ? '.' : ' or download it.');
});
$('preview').addEventListener('click', () => {
  invalidate();
  try {
    const result = previewImport(payload.value, current);
    pending = payload.value; summary(result.blueprint); confirm.disabled = false;
    $('status').textContent = result.duplicate ? 'Identical design. Confirmation will leave it unchanged.' : 'Compatible design. Review before confirming; nothing applied yet.';
  } catch (error) { $('status').textContent = `Import rejected: ${error.message} No changes applied.`; }
});
confirm.addEventListener('click', () => {
  if (pending === null || pending !== payload.value) { invalidate(); return; }
  try {
    current = confirmImport(pending); invalidate(); render();
    $('status').textContent = 'Blueprint imported into this session. No simulation has run.';
  } catch (error) { invalidate(); $('status').textContent = `Import rejected: ${error.message}`; }
});
render();
