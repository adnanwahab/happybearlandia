import { normalizeDecisionInput, DECISION_ENGINE_VERSION } from './contracts.js';
import { deriveSeed } from '../world-generator.js';

// Only explicit numeric differences have a reversible, single-setting meaning.
export function ablationChoices(input, scenarioId, model) {
  const baseline = input?.scenarios?.find(s => s.kind === 'baseline');
  const source = input?.scenarios?.find(s => s.id === scenarioId && s.kind !== 'baseline');
  if (!baseline || !source) return [];
  const coupled = [baseline, source].some(s => s.timelineFork || s.inheritsFrom || s.extendsScenarioId || s.stressPresets?.length || s.scheduledStress?.length);
  return model.parameters.filter(p => source.parameters?.[p.id] !== baseline.parameters?.[p.id]).map(p => ({
    id: p.id, label: p.label || p.id, unit: p.unit || '', from: source.parameters[p.id], to: baseline.parameters[p.id],
    blocked: coupled ? 'Forks, inheritance and stress cannot be separated safely.' : source.uncertainty?.[p.id] || baseline.uncertainty?.[p.id] ? 'This setting has an uncertainty rule; a numeric reset would not isolate its removal.' : !Number.isFinite(baseline.parameters?.[p.id]) || !Number.isFinite(source.parameters?.[p.id]) ? 'Saved numeric input is missing.' : null,
  }));
}
export function createAblation(input, scenarioId, parameterId, model, parentId) {
  const choice = ablationChoices(input, scenarioId, model).find(c => c.id === parameterId);
  if (!parentId || !choice || choice.blocked) throw new Error(choice?.blocked || 'Choose a separable setting from a saved scenario.');
  const source = structuredClone(input.scenarios.find(s => s.id === scenarioId));
  const control = { ...source, id: 'erase_control', name: 'Saved scenario · control', kind: 'baseline' };
  const variant = structuredClone(control);
  variant.id = 'erase_variant'; variant.name = `Without ${choice.label}`; variant.kind = 'alternative';
  variant.parameters[parameterId] = choice.to;
  return normalizeDecisionInput({ ...structuredClone(input), scenarios: [control, variant], metadata: { ...structuredClone(input.metadata || {}), ablation: {
    schemaVersion: 'decision-ablation.v1', parentExperimentId: parentId, sourceScenarioId: scenarioId,
    parameterId, originalValue: choice.from, restoredValue: choice.to,
    interpretation: 'Synthetic model contrast; control minus one setting restored to saved baseline. Not an observed causal effect.',
  } } }, model);
}
export function validateAblationResult(result, expected, model) {
  const e = result?.experiment;
  if (e?.status !== 'completed') throw new Error('Effect unavailable until both fresh runs finish.');
  for (const key of ['modelId', 'modelVersion', 'seed', 'runs', 'years', 'scenarios']) {
    if (JSON.stringify(e[key]) !== JSON.stringify(expected[key])) throw new Error('Returned inputs do not match the requested ablation.');
  }
  const rows = result.runs || [];
  if (rows.length !== expected.runs * 2) throw new Error('Missing paired outcomes; no effect is shown.');
  const deltas = [];
  for (let index = 0; index < expected.runs; index++) {
    const pair = expected.scenarios.map(s => rows.filter(r => r.scenarioId === s.id && r.runIndex === index));
    if (pair.some(matches => matches.length !== 1)) throw new Error('Missing or duplicate pair; no effect is shown.');
    const [a,b] = pair.map(matches => matches[0]);
    if ([a,b].some(r => r.status !== 'completed' || r.error || r.experimentId !== e.id || r.seed !== deriveSeed(expected.seed, index) || r.modelVersion !== model.version || r.engineVersion !== DECISION_ENGINE_VERSION || model.metrics.some(m => !Number.isFinite(r.metrics?.[m.id])))) throw new Error('Invalid paired execution; no effect is shown.');
    deltas.push(b.metrics.housing_supply - a.metrics.housing_supply);
  }
  return { pairs: deltas.length, meanHousingDelta: deltas.reduce((a,b) => a+b, 0) / deltas.length };
}
