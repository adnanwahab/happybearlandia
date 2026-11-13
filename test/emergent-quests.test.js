import { expect, test } from 'bun:test';
import { createQuestScenario, replayCommuteSample } from '../world/living-city/quests.js';
import { discoverQuests, updateQuests } from '../world/living-city/emergent-quests.js';
import { createSharedScenario, applyScenarioCommand } from '../world/living-city/shared-scenario.js';

test('discovery follows measurements and identities, not scenario-specific IDs', () => {
  const start = createQuestScenario();
  const state = structuredClone(start.state);
  state.businesses = [{ ...state.businesses[0], id: 'new-shop', status: 'open', viability: -20 }];
  expect(discoverQuests({ state }).find(q => q.type === 'business').entity.id).toBe('new-shop');
  state.businesses[0].viability = 0;
  expect(discoverQuests({ state }).some(q => q.type === 'business')).toBe(false);
  state.businesses[0].viability = NaN;
  expect(discoverQuests({ state }).some(q => q.type === 'business')).toBe(false);
});

test('state transitions record immutable completion and missing entities never count as success', () => {
  const start = createQuestScenario();
  const quest = start.quests.find(q => q.type === 'business');
  const state = structuredClone(start.state);
  state.month++;
  state.businesses.find(row => row.id === quest.entity.id).viability = 0;
  const [done] = updateQuests([quest], { state });
  expect(done.status).toBe('completed');
  expect(done.completion.before.value).toBeGreaterThan(0);
  expect(done.completion.after.value).toBe(0);
  expect(quest.status).toBe('active');
  state.businesses = [];
  expect(updateQuests([quest], { state })[0].status).toBe('unavailable');
  expect(updateQuests([done], { state })[0]).toEqual(done);
  expect(() => updateQuests([quest], start)).toThrow();
});

test('engine replay preserves deterministic quest receipts in both arms', () => {
  const first = replayCommuteSample({ index: 0 });
  expect(first).toEqual(replayCommuteSample({ index: 0 }));
  expect(first.intervention.quests.some(q => q.status === 'completed')).toBe(true);
  for (const arm of ['baseline', 'intervention']) for (const quest of first[arm].quests) {
    if (quest.completion) {
      expect(quest.completion.month).toBeGreaterThan(quest.provenance.month);
      expect(quest.completion.after.value).toBeLessThanOrEqual(quest.objective.target);
    }
  }
});

test('two players act on one authority and stale or unknown commands are rejected', () => {
  const parent = createSharedScenario(createQuestScenario(), ['alice', 'bob']);
  const command = { playerId: 'alice', expectedRevision: 0,
    intervention: { type: 'school', districtId: 'd0', amount: 20, cost: 0 } };
  const first = applyScenarioCommand(parent, command);
  const second = applyScenarioCommand(first, { playerId: 'bob', expectedRevision: 1 });
  expect(second.commands.map(row => row.playerId)).toEqual(['alice', 'bob']);
  expect(second.checkpoint.state.month).toBe(parent.checkpoint.state.month + 2);
  expect(parent.revision).toBe(0);
  expect(parent.commands).toEqual([]);
  expect(applyScenarioCommand(parent, command)).toEqual(first);
  expect(() => applyScenarioCommand(second, command)).toThrow('conflict');
  expect(() => applyScenarioCommand(parent, { playerId: 'eve', expectedRevision: 0 })).toThrow('Unknown');
});
