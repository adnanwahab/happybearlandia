import { BLOCK, initialMiniatures, checkDraft, confirmBlock } from './model.js';
import { resolveSnap, createHaptics } from './snap.js';
import { SQFT_TO_SQM } from '../../buildings/proposal.js';
const $ = id => document.getElementById(id);
let committed = initialMiniatures(), drafts = structuredClone(committed), selected = 0, active = false;
let priorTransform = '', pointer = null;
const pulse = createHaptics(navigator);
const pacing = { updates: 0, maxUpdateMs: 0, maxEventGapMs: 0, frames: 0, maxFrameGapMs: 0 };
let lastMove = null, frame = null, lastFrame = null;
function stopFrames() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null; lastFrame = null;
}
function trackFrame(now) {
  if (!pointer || !active) { stopFrames(); return; }
  if (lastFrame !== null) pacing.maxFrameGapMs = Math.max(pacing.maxFrameGapMs, now - lastFrame);
  lastFrame = now; pacing.frames++;
  $('board').dataset.pacing = JSON.stringify(pacing);
  frame = requestAnimationFrame(trackFrame);
}
function move(index, location, event) {
  const start = performance.now();
  const next = resolveSnap(drafts, index, location);
  const previous = drafts[index].location;
  const changed = next && (next.x !== previous.x || next.z !== previous.z);
  if (next) drafts[index].location = next;
  $('snap-feedback').textContent = next ? `Snap: ${next.x}, ${next.z} meters.` : 'Placement resisted: no valid nearby anchor.';
  if (changed || !next) pulse({ enabled: $('haptics').checked, initiated: event.isTrusted && navigator.userActivation?.isActive === true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, now: start });
  pacing.updates++; pacing.maxUpdateMs = Math.max(pacing.maxUpdateMs, performance.now() - start);
  $('board').dataset.pacing = JSON.stringify(pacing);
}
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
      move(index, { ...draft.location, x: draft.location.x + delta[0], z: draft.location.z + delta[1] }, event);
      render(); $('board').children[index].focus();
    };
    button.onpointerdown = event => {
      if (event.button !== 0) return;
      selected = index; lastMove = null;
      pointer = { id: event.pointerId, index, x: event.clientX, y: event.clientY, location: { ...draft.location } };
      button.setPointerCapture(event.pointerId);
      stopFrames(); frame = requestAnimationFrame(trackFrame);
    };
    button.onpointermove = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const rect = $('board').getBoundingClientRect();
      const now = performance.now();
      if (lastMove !== null) pacing.maxEventGapMs = Math.max(pacing.maxEventGapMs, now - lastMove);
      lastMove = now;
      move(index, { ...pointer.location, x: pointer.location.x + (event.clientX - pointer.x) * 200 / rect.width, z: pointer.location.z + (event.clientY - pointer.y) * 200 / rect.height }, event);
      button.style.left = `${(draft.location.x + 100) / 2}%`;
      button.style.top = `${(draft.location.z + 100) / 2}%`;
      inspect();
    };
    button.onpointerup = () => { pointer = null; stopFrames(); render(); $('board').children[index].focus(); };
    button.onlostpointercapture = () => {
      if (pointer?.index === index) { Object.assign(draft.location, pointer.location); pointer = null; stopFrames(); render(); }
    };
    button.onpointercancel = () => {
      if (pointer) Object.assign(draft.location, pointer.location);
      pointer = null; stopFrames(); render();
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
  active = false; pointer = null; stopFrames(); drafts = structuredClone(committed);
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

window.addEventListener('pagehide', () => { pointer = null; stopFrames(); lastMove = null; });
if (typeof navigator.vibrate !== 'function') { $('haptics').disabled = true; $('haptic-support').textContent = 'Vibration unavailable in this browser.'; }
