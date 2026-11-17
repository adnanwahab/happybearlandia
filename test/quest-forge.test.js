import { test, expect } from 'bun:test';
import { authoredDemo } from '../world/quest-forge/demo.js';
import { forgeQuest, forgeRequests, verifyQuest } from '../world/quest-forge/model.js';

test('pinned authored request produces deterministic immutable origin, objective, resources and checkpoint', async () => {
  const quest = await authoredDemo();
  expect(quest).toEqual(await authoredDemo());
  expect(quest.origin.sourceKind).toBe('authored-demo');
  expect(quest.origin.checkpointHash).toBe(quest.challenge.initialHash);
  expect(quest.challenge.seed).toBe(42);
  expect(quest.digest).toBe('147576cbe2937871188c9091775c9d2004f6601e814d01b87b772a9943dff149');
  expect(quest.challenge.initialHash).toBe('66c28abf46655f29948592a54bef7f0608d6652212560d4a7813da6065ccccae');
  expect(quest.challenge.months).toBe(20);
  expect(quest.challenge.budget.cap).toBe(5000);
  expect(Object.isFrozen(quest.origin)).toBe(true);
  expect(Object.isFrozen(quest.challenge.initialState.households[0])).toBe(true);
  expect(quest.limitations).toContain('No real resident endorsement');
});

test('real City integration succeeds with housing and fails with no action, preserving the source and matched seeds', async () => {
  const quest = await authoredDemo(), before = JSON.stringify(quest);
  const success = await verifyQuest(quest, { selection: ['housing'] });
  const failure = await verifyQuest(quest, { selection: [] });
  expect(success.result.won).toBe(true);
  expect(success.result.reference.unhousedHouseholds).toBe(6);
  expect(success.result.candidate.unhousedHouseholds).toBe(4);
  expect(success.result.budget.candidateSpent).toBe(1000);
  expect(success.result.guards.every(row => row.passed)).toBe(true);
  expect(failure.result.won).toBe(false);
  expect(failure.result.status).toBe('not-beaten');
  expect(success.origin).toEqual(quest.origin);
  expect(success.result.reference.seed).toBe(success.result.candidate.seed);
  expect(success.result.reference.initialHash).toBe(success.result.candidate.initialHash);
  expect(success).toEqual(await verifyQuest(quest, { selection: ['housing'] }));
  expect(JSON.stringify(quest)).toBe(before);
});

test('unsupported, absent, duplicate and incompatible source records produce explicit refusals', async () => {
  const quest = await authoredDemo(), state = quest.challenge.initialState;
  expect(await forgeRequests([], state)).toEqual({ status: 'no-source-data', quests: [], rejected: [] });
  for (const patch of [{ concern: 'endorse-my-policy' }, { checkpointHash: '0'.repeat(64) }, { modelVersion: 'old' }, { districtId: 'foreign-population-id' }, { revision: 0 }, { sourceRef: '' }, { sourceKind: 'measured-endorsement' }, { score: 100 }]) {
    const result = await forgeRequests([{ ...quest.origin, ...patch }], state);
    expect(result.status).toBe('unsupported'); expect(result.quests).toEqual([]); expect(result.rejected).toHaveLength(1);
  }
  const duplicate = await forgeRequests([quest.origin, quest.origin], state);
  expect(duplicate.quests).toHaveLength(1); expect(duplicate.rejected[0].reason).toContain('Duplicate');
  await expect(forgeRequests(Array(33).fill(quest.origin), state)).rejects.toThrow('32');
  // Disposable source-adapter fixture; this does not attest any real submission.
  const logged = await forgeQuest({ ...quest.origin, sourceKind: 'logged-request', id: 'fixture-request', sourceRef: 'fixture-log:request-1:revision-1' }, state);
  expect(logged.origin.sourceKind).toBe('logged-request');
  expect(logged.limitations).toContain('do not authenticate');
});

test('cancel and replay/source/terms mismatch never yield a forged result', async () => {
  const quest = await authoredDemo(), controller = new AbortController(); controller.abort();
  await expect(verifyQuest(quest, { selection: ['housing'] }, { signal: controller.signal })).rejects.toThrow('cancelled');
  const running = new AbortController();
  let observedMonth = 0;
  await expect(verifyQuest(quest, { selection: ['housing'] }, {
    signal: running.signal,
    onProgress: progress => { observedMonth = progress.completed; running.abort(); },
  })).rejects.toThrow('cancelled');
  expect(observedMonth).toBe(1);
  for (const change of [q => q.challenge.seed++, q => q.challenge.initialState.month++, q => q.origin.text = 'altered', q => q.origin.revision++, q => q.winCondition = 'Always win', q => q.challenge.guards.employmentNotBelowReference = false, q => q.digest = '0'.repeat(64)]) {
    const changed = structuredClone(quest); change(changed);
    await expect(verifyQuest(changed, { selection: ['housing'] })).rejects.toThrow();
  }
  await expect(verifyQuest(quest, { selection: ['housing'], score: 100 })).rejects.toThrow();
});
