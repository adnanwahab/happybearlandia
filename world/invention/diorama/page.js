import { BLOCK, initialMiniatures, checkDraft, confirmBlock } from './model.js';
import { SQFT_TO_SQM } from '../../buildings/proposal.js';
const $ = id => document.getElementById(id);
let committed = initialMiniatures(), drafts = structuredClone(committed), selected = 0, active = false;
let priorTransform = '', pointer = null;
const money = value => value.toLocaleString('en-US');
function render() {
  $('board').replaceChildren();
  drafts.forEach((draft, index) => {
    const button = document.createElement('button');
    button.className = 'miniature';
    button.textContent = `${index + 1} ↔`;
    button.setAttribute('aria-label', `${draft.name} drag handle`);
    button.setAttribute('aria-pressed', String(selected === index));
    button.disabled = !active;
    const size = Math.sqrt(draft.geometry.footprintSqFt * SQFT_TO_SQM) / 2;
    Object.assign(button.style, { width: `${size}%`, height: `${size}%`, left: `${(draft.location.x - BLOCK.minX) / 2}%`, top: `${(draft.location.z - BLOCK.minZ) / 2}%`, transform: `translate(-50%,-50%) rotate(${draft.location.rotation}rad)` });
    button.onclick = () => { selected = index; render(); $('board').children[index].focus(); };
    button.onkeydown = event => {
      const delta = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[event.key];
      if (!delta) return;
      event.preventDefault(); selected = index;
      draft.location.x += delta[0]; draft.location.z += delta[1];
      render(); $('board').children[index].focus();
    };
    button.onpointerdown = event => {
      if (event.button !== 0) return;
      selected = index;
      pointer = { id: event.pointerId, index, x: event.clientX, y: event.clientY, location: { ...draft.location } };
      button.setPointerCapture(event.pointerId);
    };
    button.onpointermove = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const rect = $('board').getBoundingClientRect();
      draft.location.x = Math.round(pointer.location.x + (event.clientX - pointer.x) * 200 / rect.width);
      draft.location.z = Math.round(pointer.location.z + (event.clientY - pointer.y) * 200 / rect.height);
      button.style.left = `${(draft.location.x + 100) / 2}%`;
      button.style.top = `${(draft.location.z + 100) / 2}%`;
      inspect();
    };
    button.onpointerup = () => { pointer = null; render(); $('board').children[index].focus(); };
    button.onpointercancel = () => {
      if (pointer) Object.assign(draft.location, pointer.location);
      pointer = null; render();
    };
    $('board').append(button);
  });
  $('selection').replaceChildren(...drafts.map((draft, i) => new Option(draft.name, i)));
  $('selection').value = String(selected);
  inspect();
}
function inspect() {
  const draft = drafts[selected];
  $('x').value = draft.location.x; $('z').value = draft.location.z;
  $('inspection').textContent = `${draft.name} · ${draft.id} · ${draft.geometry.floors} floors · ${draft.geometry.footprintSqFt} sqft footprint · ${Math.round(draft.location.rotation * 180 / Math.PI)}° · ${draft.program.residentialUnits} proposed homes. Permit ${draft.construction.permitMonths} months; build ${draft.construction.buildMonths} months before seeded delays.`;
  $('cost').textContent = `Block estimated cost: $${money(drafts.reduce((sum, row) => sum + row.finance.estimatedCost, 0))}; public subsidy: $${money(drafts.reduce((sum, row) => sum + row.finance.publicSubsidy, 0))}. Shared capacity, financing risk and delays apply in simulation; completion is not guaranteed.`;
  const validation = checkDraft(drafts);
  $('constraints').textContent = [validation.valid ? 'Geometry checks pass: bounds, overlaps and floor capacity.' : 'Rejected: ' + validation.errors.join(' '), ...validation.warnings].join(' ');
  $('confirm').disabled = !active || !validation.valid;
}
$('enter').onclick = () => {
  priorTransform = $('board').style.transform;
  active = true; drafts = structuredClone(committed);
  $('board').classList.add('tabletop'); $('board').style.transform = 'scale(1)';
  $('editor').hidden = false; $('exit').hidden = false; $('enter').hidden = true;
  $('view-state').textContent = 'Tabletop view · draft only'; render(); $('board').children[selected].focus();
};
function exit() {
  if (!active) return;
  active = false; pointer = null; drafts = structuredClone(committed);
  $('board').classList.remove('tabletop'); $('board').style.transform = priorTransform;
  $('editor').hidden = true; $('exit').hidden = true; $('enter').hidden = false;
  $('view-state').textContent = 'World view · local schematic camera'; render(); $('enter').focus();
}
$('exit').onclick = exit;
document.addEventListener('keydown', event => { if (event.key === 'Escape') exit(); });
$('selection').onchange = () => { selected = Number($('selection').value); render(); };
for (const axis of ['x', 'z']) $(axis).oninput = () => {
  drafts[selected].location[axis] = $(axis).valueAsNumber;
  const handle = $('board').children[selected];
  handle.style.left = `${(drafts[selected].location.x + 100) / 2}%`;
  handle.style.top = `${(drafts[selected].location.z + 100) / 2}%`;
  // Keep input focus and partial numeric text while typing.
  const text = $(axis).value; inspect(); $(axis).value = text;
};
$('rotate').onclick = () => { drafts[selected].location.rotation = (drafts[selected].location.rotation + Math.PI / 4) % (2 * Math.PI); render(); };
$('confirm').onclick = () => {
  if (!active) return;
  const result = confirmBlock(drafts);
  if (!result.valid) { $('status').textContent = result.errors.join(' '); return; }
  committed = structuredClone(drafts);
  $('status').textContent = 'Confirmed local block · simulation recomputed through month 120.';
  $('result').textContent = `${result.run.projectMetrics.completedUnits} project homes completed; $${money(Math.round(result.run.projectMetrics.publicCost))} modeled public project spending. Each project retains its proposal ID, monthly states, seeded uncertainty and approval events. This is a modeled result, not a forecast.`;
};
render();
