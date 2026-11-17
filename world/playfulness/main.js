import { createExperiment } from './core.js';
const root = document.querySelector('#playfulness');
const consent = root.querySelector('input');
const status = root.querySelector('[role=status]');
const prompt = root.querySelector('[data-prompt]');
const controls = root.querySelector('[data-actions]');
let experiment, state;
function render() {
  consent.checked = !!state;
  controls.hidden = !state;
  prompt.textContent = state?.arm === 'playful' ? 'Put on your city detective hat: inspect one result and explain which assumption could change it.' : state ? 'Inspect one result and explain which assumption could change it.' : '';
  status.textContent = JSON.stringify(experiment.summary()) || 'No participation or measurements.';
}
function unavailable() { state = null; controls.hidden = true; prompt.textContent = ''; consent.checked = false; consent.disabled = true; status.textContent = 'Local storage unavailable. Experiment inactive; exploring still works.'; }
try {
  experiment = createExperiment({storage:localStorage, enabled:root.dataset.enabled === 'true'});
  state = experiment.read(); render();
  root.hidden = root.dataset.enabled !== 'true';
} catch { unavailable(); }
consent.addEventListener('change', () => {
  try { state = consent.checked ? experiment.consent() : (experiment.withdraw(), null); render(); }
  catch { try { experiment.withdraw(); } catch {} unavailable(); }
});
for (const button of controls.querySelectorAll('button')) button.addEventListener('click', () => {
  try { experiment.record(button.dataset.event); render(); }
  catch (error) { status.textContent = error.message; }
});

window.addEventListener('storage', event => {
  if (event.key === 'hbl.playfulness.v1' || event.key === null) {
    try { state = experiment.read(); render(); } catch { unavailable(); }
  }
});
