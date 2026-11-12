import { test, expect } from 'bun:test';
import { plan, compareReplay, triageDraft, LAB_VERSION } from '../tools/player-lab/lab.js';
import { submitFinding } from '../tools/player-lab/triage.js';
const failed = () => ({ version: LAB_VERSION, revision: 'abc', scenario: plan(2911, 'too-late'), steps: [], finalState: { month: '240' }, status: 'failed', findings: [{ kind: 'broken-state', message: 'Missing outcome', step: 0 }] });
test('policies are repeatable, bounded and cover distinct timing strategies', () => {
  for (const seed of [0, 1, 2911, 0xffffffff]) {
    expect(plan(seed, 'first-play').month).toBe(72);
    expect(plan(seed, 'last-chance').month).toBeLessThanOrEqual(74);
    expect(plan(seed, 'too-late').month).toBeGreaterThanOrEqual(75);
    expect(plan(seed, 'too-late').month).toBeLessThanOrEqual(240);
    expect(plan(seed, 'too-late')).toEqual(plan(seed, 'too-late'));
  }
  for (const seed of [-1, NaN, 1.5, 2 ** 32]) expect(() => plan(seed, 'first-play')).toThrow();
  expect(() => plan(1, 'unknown')).toThrow();
});
test('replay detects changed observations and refuses mismatched revisions', () => {
  const run = failed();
  expect(compareReplay(run, structuredClone(run))).toBe(true);
  expect(compareReplay(run, { ...run, finalState: null })).toBe(false);
  expect(() => compareReplay(run, { ...run, revision: 'new' })).toThrow();
});
test('triage creates only an unassigned issue in the resolved Triage state', async () => {
  const calls = [];
  const issue = await submitFinding(failed(), 'team', async (query, variables) => {
    calls.push({ query, variables });
    return calls.length === 1 ? { team: { states: { nodes: [{ id: 'backlog', type: 'backlog' }, { id: 'triage', type: 'triage' }] } } } : { issueCreate: { success: true, issue: { id: 'finding' } } };
  });
  expect(issue.id).toBe('finding');
  expect(calls[1].variables.input.stateId).toBe('triage');
  expect(Object.keys(calls[1].variables.input).sort()).toEqual(['description', 'stateId', 'teamId', 'title']);
  expect(calls[1].variables.input.description).toContain('human triage required');
});
test('triage fails closed without Triage or failed evidence', async () => {
  expect(() => triageDraft({ ...failed(), status: 'passed' })).toThrow();
  let calls = 0;
  await expect(submitFinding(failed(), 'team', async () => { calls++; return { team: { states: { nodes: [] } } }; })).rejects.toThrow('no Triage');
  expect(calls).toBe(1);
  await expect(submitFinding(failed(), 'team', async query => query.startsWith('query') ? { team: { states: { nodes: [{ id: 't', type: 'triage' }] } } } : { issueCreate: { success: false } })).rejects.toThrow('did not confirm');
});
test('failed browser actions retain failed step, seed and final observation', async () => {
  const { runPlayer } = await import('../tools/player-lab/lab.js');
  const page = { on() {}, off() {}, async goto() { throw new Error('Navigation failed'); }, async evaluate() { return { month: null, scene: null }; } };
  const run = await runPlayer(page, { seed: 9, strategy: 'first-play' }, 'abc');
  expect(run.status).toBe('failed');
  expect(run.scenario.seed).toBe(9);
  expect(run.steps[0].error).toBe('Navigation failed');
  expect(run.findings[0].step).toBe(0);
  expect(run.finalState).toEqual({ month: null, scene: null });
});
