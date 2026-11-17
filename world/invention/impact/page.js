import { futureURL, runPlan } from '../model.js';
import { createPacer, estimate, handleOptions, setCapacity } from './model.js';
const $ = id => document.getElementById(id);
const input = id => /** @type {HTMLInputElement} */ ($(id));
const project = /** @type {HTMLSelectElement} */ ($('project'));
const undo = /** @type {HTMLButtonElement} */ ($('undo'));
const replay = /** @type {HTMLAnchorElement} */ ($('replay'));
let plan = setCapacity({}, 4), history = [], executed = null;
const events = new AbortController();
const listen = (id, name, fn) => $(id).addEventListener(name, fn, { signal: events.signal });
const pacer = createPacer({ request: requestAnimationFrame, cancel: cancelAnimationFrame, now: () => performance.now(), paint: render });
function render() {
  const row = estimate(plan);
  input('capacity').value = input('numeric').value = String(row.capacity);
  $('estimate').textContent = `Proposed +${row.capacity} capacity; ${row.cost.toLocaleString('en-US')} illustrative USD. Pre-run estimate only.`;
  $('manifest').textContent = JSON.stringify(row.recipe, null, 2);
  undo.disabled = history.length === 0;
  if (executed) $('outcome').textContent = `${JSON.stringify(executed.recipe) === JSON.stringify(plan) && project.value === 'transit' ? 'Current' : 'Previous'} executed plan: +${estimate(executed.recipe).capacity} capacity; month ${executed.final.month}; policy stage ${executed.final.policyStages[0].stage}; public balance ${executed.final.publicBalance.toFixed(2)} illustrative USD; mean commute ${executed.final.meanCommuteMinutes?.toFixed(2) ?? 'unavailable'} minutes (${executed.final.commuteCount} trips). Proposed cost remains an assumption, not measured spending.`;
  $('pacing').textContent = `${pacer.metrics.samples} paints; maximum queued wait ${pacer.metrics.maxWaitMs.toFixed(1)} ms; ${pacer.metrics.slowFrames} waits above 34 ms. No continuous overlay loop.`;
}
function change(value, deferred = false) {
  try {
    const next = setCapacity(plan, value);
    if (JSON.stringify(next) !== JSON.stringify(plan)) { history.push(plan); plan = next; }
    $('error').textContent = '';
    if (deferred) pacer.schedule(); else render();
  } catch (error) { $('error').textContent = error.message; render(); }
}
listen('capacity', 'input', event => change(Number(event.target.value), true));
listen('numeric', 'change', event => change(event.target.value === '' ? NaN : Number(event.target.value)));
listen('undo', 'click', () => { if (history.length) plan = history.pop(); $('error').textContent = ''; render(); });
listen('project', 'change', () => {
  const supported = !!handleOptions(project.value, 'd1');
  $('controls').hidden = !supported; $('unsupported').hidden = supported;
  $('error').textContent = ''; render();
});
listen('run', 'click', () => {
  try {
    executed = runPlan(plan);
    replay.href = futureURL(executed.recipe); $('replay').hidden = false;
    $('error').textContent = ''; render();
  } catch (error) {
    $('error').textContent = `Execution failed: ${error.message}. No new outcome recorded.`;
  }
});
window.addEventListener('pagehide', () => { pacer.dispose(); events.abort(); }, { once: true });
// A restored back/forward-cache page must regain its disposed controls.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
render();
