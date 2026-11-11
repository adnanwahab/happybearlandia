import { draw } from '../city/contracts.js';
import { assessFlood } from './impacts.js';
import { simulateWater } from './physics.js';
import { buildings, compileStorm, normalizeStorm, roads } from './scenario.js';

export const impactMetrics = Object.freeze({
  closedRoads: 'Road links closed',
  floodedBuildings: 'Buildings exposed to inundation',
  affectedHouseholds: 'Households inundated or isolated',
  isolatedBusinesses: 'Businesses cut off from the depot',
  isolatedServices: 'Services cut off from the depot',
});

export function consequences(water) {
  return assessFlood({ size: water.size, roads, buildings,
    frames: water.frames.map((depth, tick) => ({ tick, depth })) });
}

export function runStormEnsemble(input, progress = () => {}) {
  const recipe = normalizeStorm(input);
  const control = compileStorm({ ...recipe, edits: [] });
  const edited = compileStorm(recipe);
  const metrics = Object.fromEntries(Object.keys(impactMetrics).map(key => [key, {
    baseline: 0, adjusted: 0, improved: 0, worsened: 0, unchanged: 0,
  }]));
  for (let sample = 0; sample < 100; sample++) {
    const rainRate = Math.min(0.06, recipe.rainRate * (0.55 + 0.9 * draw(recipe.seed, sample, 'storm-rain')));
    const baseline = consequences(simulateWater({ ...control, rainRate })).totals;
    const adjusted = consequences(simulateWater({ ...edited, rainRate })).totals;
    for (const [key, row] of Object.entries(metrics)) {
      row.baseline += baseline[key];
      row.adjusted += adjusted[key];
      const outcome = adjusted[key] < baseline[key] ? 'improved' : adjusted[key] > baseline[key] ? 'worsened' : 'unchanged';
      row[outcome]++;
    }
    if ((sample + 1) % 5 === 0) progress(sample + 1);
  }
  for (const row of Object.values(metrics)) {
    row.baseline /= 100;
    row.adjusted /= 100;
  }
  return metrics;
}
