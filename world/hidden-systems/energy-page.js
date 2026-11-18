import { ENERGY_DEMO, startEnergy, dispatchEnergy, cancelEnergy, verifyEnergy } from './energy-model.js';
const find = id => document.getElementById(id);
let run = null;
function render() {
  find('source').textContent = JSON.stringify(run.source, null, 2);
  find('energy-status').textContent = run.status === 'playing'
    ? `Wave ${run.actions.length + 1} / 3: ${run.source.waves[run.actions.length].id}; demand ${run.source.waves[run.actions.length].demand}; battery ${run.battery}.`
    : `${run.status}: battery ${run.battery}. ${run.status === 'cancelled' ? 'Remaining waves were not computed.' : ''}`;
  find('checkpoints').textContent = run.checkpoints.length ? JSON.stringify(run.checkpoints, null, 2) : 'No results.';
  find('commit').disabled = find('cancel').disabled = run.status !== 'playing';
  find('verify').disabled = false;
  find('verification').textContent = '';
}
find('load').onclick = () => { run = startEnergy(ENERGY_DEMO); render(); };
find('dispatch').onsubmit = event => {
  event.preventDefault();
  try { run = dispatchEnergy(run, Number(new FormData(event.currentTarget).get('generation'))); render(); }
  catch (error) { find('energy-status').textContent = error.message; }
};
find('cancel').onclick = () => { run = cancelEnergy(run); render(); };
find('verify').onclick = () => {
  find('verification').textContent = verifyEnergy(run)
    ? 'Replay verified against retained checkpoints with the same source, versions, seed and actions.'
    : 'Replay mismatch: retained checkpoints preserved; results are unverified.';
};
