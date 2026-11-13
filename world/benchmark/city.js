import { createCity } from '../city/seed.js';
import { createEngine, cityMetrics, addIntervention, scheduleShock } from '../city/engine.js';
import { VERSION } from '../city/contracts.js';
import { stateHash } from '../future-machine/data/core.js';

export default {
  id: VERSION,
  rules: createEngine().manifest,
  source: 'illustrative-city.v1',
  async run(scenario, seed) {
    const engine = createEngine();
    let state = createCity({ seed, households: scenario.households });
    if (scenario.intervention) state = addIntervention(state, scenario.intervention);
    if (scenario.shock) state = scheduleShock(state, scenario.shock);
    const initial = structuredClone(state), history = [], active = new Set();
    let transitions = 0;
    for (let month = 0; month < scenario.months; month++) {
      const step = engine.step(state);
      // Count committed monthly changes to individual model records, not evaluations.
      for (const collection of ['households', 'workers', 'businesses']) {
        const before = new Map(state[collection].map(row => [row.id, row]));
        for (const row of step.state[collection]) {
          if (JSON.stringify(before.get(row.id)) !== JSON.stringify(row)) {
            active.add(`${collection}:${row.id}`); transitions++;
          }
        }
      }
      history.push(step); state = step.state;
    }
    const metrics = cityMetrics(state);
    if (!Object.values(metrics).every(Number.isFinite)) throw new Error('Nonfinite metrics');
    return { digest: await stateHash({ initial, history }), metrics,
      counts: { activeAgents: active.size, executedStateTransitions: transitions,
        interAgentInteractions: null, validatedNumericalResults: Object.keys(metrics).length } };
  },
};
