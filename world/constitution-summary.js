export function compactConstitutionResult(result) {
  if (!result?.meta || !result?.final || !result?.futures) throw new Error('A completed paired result is required');
  const metrics = Object.entries(result.final).slice(0, 12).map(([id, value]) => {
    const numbers = [value?.baseline?.mean, value?.plan?.mean, value?.delta?.mean, value?.delta?.p10, value?.delta?.p90];
    if (!numbers.every(Number.isFinite)) throw new Error('Invalid metric values');
    return { id, baseline:numbers[0], plan:numbers[1], delta:numbers[2], p10:numbers[3], p90:numbers[4] };
  });
  if (!metrics.length) throw new Error('No metrics supplied');
  return { seeds: result.meta.seeds, year:result.futures.year, metrics };
}
export function localConstitutionSummary(facts) {
  const m=facts.metrics.find(m=>m.id==='displacedResidents') || facts.metrics[0];
  return `HappyBearLandia compared the same synthetic town and paired random seeds with and without the plan. At year ${facts.year}, ${m.id === 'displacedResidents' ? 'modeled storm displacement' : m.id} averaged ${m.baseline} in the baseline and ${m.plan} with the plan (difference ${m.delta}; paired p10–p90 spread ${m.p10} to ${m.p90}). This spread describes the sampled futures, not a confidence interval. Physical additions are schematic illustrations of modeled interventions, not engineering designs or exact construction locations. These simulated counterfactuals are illustrative, not forecasts; unsupported policies have no modeled effect.`;
}
