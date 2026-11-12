import { createEngine, addIntervention } from '../city/engine.js';
import { discoverQuests, updateQuests } from './emergent-quests.js';

// Local authority only. Transport, durable storage and authenticated identities
// must be provided before exposing this contract as an online shared world.
export function createSharedScenario(checkpoint, players) {
  if (!Array.isArray(players) || !players.length || players.some(id => typeof id !== 'string' || !id.trim()) || new Set(players).size !== players.length)
    throw new Error('Provide unique player IDs.');
  return structuredClone({ version: 'shared-city.v1', revision: 0, players,
    checkpoint, quests: discoverQuests(checkpoint), commands: [] });
}

export function applyScenarioCommand(scenario, { playerId, expectedRevision, intervention }) {
  if (!scenario.players.includes(playerId)) throw new Error('Unknown scenario player.');
  if (expectedRevision !== scenario.revision) throw new Error('Scenario revision conflict.');
  const state = intervention ? addIntervention(scenario.checkpoint.state, intervention) : scenario.checkpoint.state;
  const checkpoint = createEngine().step(state);
  const quests = updateQuests(scenario.quests, checkpoint);
  for (const quest of discoverQuests(checkpoint)) if (!quests.some(row => row.id === quest.id)) quests.push(quest);
  return { ...structuredClone(scenario), revision: scenario.revision + 1, checkpoint, quests,
    commands: [...scenario.commands, { playerId, revision: scenario.revision + 1,
      month: checkpoint.state.month, intervention: structuredClone(intervention ?? null) }] };
}
