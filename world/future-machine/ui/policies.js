import { DEFAULT_RECIPE } from '../contracts.js';

// Bounded inputs to the existing City housing/construction rules, not new models.
export const POLICY_CHOICES = Object.freeze([
  Object.freeze({ id: 'housing', label: 'Build 24 homes · 1,000,000 USD', intervention: DEFAULT_RECIPE.intervention }),
  Object.freeze({ id: 'housing-small', label: 'Build 12 homes · 500,000 USD', intervention: Object.freeze({ ...DEFAULT_RECIPE.intervention, amount: 12, cost: 500000 }) }),
  Object.freeze({ id: 'baseline', label: 'No intervention (matched control)', intervention: null }),
]);

function samePolicy(a, b) {
  return a === null || b === null ? a === b :
    [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => a[key] === b[key]);
}
export function policyChoices(intervention) {
  const choices = [...POLICY_CHOICES];
  if (!choices.some(choice => samePolicy(choice.intervention, intervention))) {
    choices.unshift({ id: 'saved', label: 'Loaded recipe intervention', intervention: structuredClone(intervention) });
  }
  return choices.map(choice => ({ ...choice, description: choice.intervention
    ? `${choice.intervention.amount} proposed ${choice.intervention.type === 'housing' ? 'homes' : choice.intervention.type} · ${choice.intervention.cost} illustrative USD · district ${choice.intervention.districtId}. Delay ${choice.intervention.delay ?? 0} months; compliance ${choice.intervention.compliance ?? 1}. Source: monthly City policy and construction rules (${DEFAULT_RECIPE.modelVersion}); synthetic, uncalibrated inputs. Construction and funding constraints still apply.`
    : 'No policy added. Compare two unchanged futures from the same initial state and seed using the monthly City model.' }));
}
export function policyId(intervention) {
  return policyChoices(intervention).find(choice => samePolicy(choice.intervention, intervention)).id;
}
