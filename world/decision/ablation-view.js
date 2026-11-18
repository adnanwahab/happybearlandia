import { ablationChoices, createAblation, validateAblationResult } from './ablation.js';
import { experimentInputFromManifest } from './client.js';
import { resolveHousingModel } from '../models/housing/index.js';

export function mountAblation(container, { client, getContext }) {
  container.innerHTML = `<h3>Erase one intervention</h3><p class="fine">From a saved scenario, restore exactly one numeric setting to its saved baseline value. Recompute both sides with the same seeds and all other inputs preserved. Draft edits are excluded.</p><label>Saved scenario<select data-erase-scenario></select></label><label>Setting to erase<select data-erase-setting></select></label><button data-erase-run class="full quiet">Erase one and recompute</button><p data-erase-status role="status" aria-live="polite">Save an experiment first.</p><p class="fine">Sources stay in the saved evidence record. Defaults and rules are synthetic assumptions; the result is a computed model contrast, not real-world causation. The surrounding city scene is schematic.</p>`;
  const scenario = container.querySelector('[data-erase-scenario]'), setting = container.querySelector('[data-erase-setting]'), button = container.querySelector('button'), status = container.querySelector('[role=status]');
  let key = '', pending = false, generation = 0, watch = null;
  const option = (value, label) => { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; };
  function settings() {
    const { experiment } = getContext();
    const model = resolveHousingModel(experiment?.modelVersion).model;
    setting.replaceChildren(...ablationChoices(experiment, scenario.value, model).map(c => {
      const node = option(c.id, `${c.label}: ${c.from} → ${c.to}${c.blocked ? ` · Blocked: ${c.blocked}` : ''}`); node.disabled = Boolean(c.blocked); return node;
    }));
    const first = [...setting.options].find(o => !o.disabled); setting.value = first?.value || '';
  }
  function update() {
    const { experiment, readonly, busy } = getContext();
    const next = experiment?.id || '';
    if (next !== key) {
      key = next; generation++; watch?.destroy(); pending = false;
      scenario.replaceChildren(...(experiment?.scenarios || []).filter(s => s.kind !== 'baseline').map(s => option(s.id, s.name)));
      settings(); status.textContent = key ? (setting.value ? 'Choose a setting. No ablation effect has been computed.' : 'No separable numeric changes. Coupled settings are blocked; no effect is available.') : 'Save an experiment first.';
    }
    button.disabled = pending || readonly || busy || !key || !setting.value;
    scenario.disabled = setting.disabled = pending || readonly || busy;
  }
  scenario.addEventListener('change', () => { settings(); status.textContent = setting.value ? 'Choose a setting. No ablation effect has been computed.' : 'No separable numeric changes. Coupled settings are blocked; no effect is available.'; update(); });
  setting.addEventListener('change', () => { status.textContent = 'Setting changed. Recompute to reveal its effect.'; });
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const token = ++generation, parent = key, scenarioId = scenario.value, parameterId = setting.value;
    pending = true; update(); status.textContent = 'Pending: loading saved inputs, then rerunning the full control and one-setting variant with matched seeds. No effect yet.';
    try {
      const input = experimentInputFromManifest(await client.manifest(parent));
      if (token !== generation) return;
      const model = resolveHousingModel(input.modelVersion).model;
      const expected = createAblation(input, scenarioId, parameterId, model, parent);
      const created = await client.create(expected); if (token !== generation) return;
      await client.start(created.experiment.id); if (token !== generation) return;
      watch = client.watch(created.experiment.id, { onUpdate(result) {
        if (token !== generation) return;
        if (!['completed','failed','cancelled'].includes(result.experiment?.status)) return;
        try {
          const effect = validateAblationResult(result, expected, model);
          status.textContent = `Computed synthetic effect of erasing ${parameterId}: ${effect.meanHousingDelta.toFixed(2)} homes (variant minus control, mean across ${effect.pairs} matched seed pairs at year ${expected.years}). Fresh experiment ${result.experiment.id}. Not a forecast or an observed causal effect.`;
        } catch (error) { status.textContent = `Effect unavailable: ${error.message}`; }
        pending = false; update();
      }, onError(error) { if (token === generation) { pending = false; status.textContent = `Effect unavailable: ${error.message}`; update(); } } });
    } catch (error) { if (token === generation) { pending = false; status.textContent = `Effect unavailable: ${error.message}`; update(); } }
  });
  addEventListener('pagehide', () => { generation++; watch?.destroy(); });
  return { update };
}
