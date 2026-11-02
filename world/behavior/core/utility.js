/** Stable multinomial logit probabilities. Infeasible alternatives are filtered first. */
export function stableSoftmax(scores, temperature = 1) {
  if (!Array.isArray(scores) || scores.some(value => !Number.isFinite(value))) throw new TypeError('Utilities must be finite numbers.');
  if (!Number.isFinite(temperature) || temperature <= 0) throw new TypeError('Temperature must be positive.');
  if (!scores.length) return [];
  const maximum = Math.max(...scores);
  const weights = scores.map(score => Math.exp((score - maximum) / temperature));
  const sum = weights.reduce((total, value) => total + value, 0);
  return weights.map(value => value / sum);
}

export function weightedUtility(features, coefficients) {
  const components = {};
  for (const [name, value] of Object.entries(features)) {
    if (!Number.isFinite(value) || !Number.isFinite(coefficients[name])) throw new TypeError(`Invalid utility component: ${name}`);
    components[name] = value * coefficients[name];
    if (!Number.isFinite(components[name])) throw new RangeError(`Utility overflow: ${name}`);
  }
  const utility = Object.values(components).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(utility)) throw new RangeError('Utility sum overflow.');
  return { components, utility };
}
