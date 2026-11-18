import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildQueue, reviewDraft } from '../ops/launch-triage/queue.js';
import { readStores } from '../ops/launch-triage/read-stores.js';
import { createPlayerFeedbackHandler } from '../ops/player-feedback/api.js';
import { createPatchVotingHandler } from '../ops/patch-voting/api.js';
const backlog = { version: 1, revision: 'fixture-only-2026-11-17', completeFamilies: ['HBL-FUN', 'HBL-W1', 'HBL-SYM'], issues: [
  { id: 'SHE-586', title: '[HBL-FUN-098] In-place Wow Confusing feedback' },
  { id: 'SHE-52', title: '[HBL-W1-039] Capture player feedback with consent' },
  { id: 'SHE-126', title: '[HBL-SYM-049] Issue readiness and dispatch checklist' }
] };
const suggestion = { id: 'one', title: 'Confusing feedback', details: 'private person@example.com secret', kind: 'confusing', status: 'pending', created_at: 1, replay_seed: null };
const decision = queue => ({ queueRevision: queue.revision, key: queue.entries[0].key, reviewed: true, duplicateSearchReviewed: true, action: 'preview-new', noExistingIssue: true });

test('duplicates preserve original evidence and consent limitations; stable retry and ordering', () => {
  const other = { ...suggestion, id: 'two', title: '  Confusing   feedback ' };
  const queue = buildQueue({ backlog, suggestions: [suggestion, other, suggestion] });
  expect(queue.entries).toHaveLength(1);
  expect(queue.entries[0].sources.map(s => s.id)).toEqual(['one', 'two']);
  expect(queue.entries[0].sources[0].details).toBe(suggestion.details);
  expect(queue.entries[0].sources[0].consent).toContain('receipt unavailable');
  expect(queue.entries[0].matches.map(i => i.id)).toContain('SHE-586');
  expect(buildQueue({ backlog, suggestions: [other, suggestion] })).toEqual(queue);
  expect(() => buildQueue({ backlog, suggestions: [suggestion, { ...suggestion, details: 'changed content' }] })).toThrow();
  expect(buildQueue({ backlog, suggestions: [suggestion, { ...other, replay_seed: 'different-run' }] }).entries).toHaveLength(2);
});

test('review fails closed; links existing work; safe public preview contains no input text', () => {
  const queue = buildQueue({ backlog, suggestions: [suggestion] });
  const review = decision(queue);
  for (const change of [{ reviewed: false }, { duplicateSearchReviewed: false }, { queueRevision: 'stale' }, { noExistingIssue: false }, { key: 'unknown' }]) {
    expect(() => reviewDraft(queue, { ...review, ...change })).toThrow();
  }
  const altered = structuredClone(queue);
  altered.entries[0].sources[0].details = 'changed evidence';
  expect(() => reviewDraft(altered, review)).toThrow();
  const preview = reviewDraft(queue, review);
  expect(preview.requiresManualCreation).toBe(true);
  expect(JSON.stringify(preview)).not.toContain('person@example.com');
  expect(JSON.stringify(preview)).not.toContain('secret');
  expect(JSON.stringify(preview)).not.toContain('SHE-586');
  expect(reviewDraft(queue, { ...review, action: 'link-existing', issueId: 'SHE-586' }).issueId).toBe('SHE-586');
  expect(() => reviewDraft(queue, { ...review, action: 'link-existing', issueId: 'SHE-999' })).toThrow();
  const partial = buildQueue({ backlog: { ...backlog, completeFamilies: ['HBL-FUN'] }, suggestions: [suggestion] });
  expect(() => reviewDraft(partial, decision(partial))).toThrow();
  const updated = buildQueue({ backlog: { ...backlog, revision: 'new-search' }, suggestions: [suggestion] });
  expect(() => reviewDraft(updated, review)).toThrow();
});

test('tally and PR head revisions cannot reuse old review; votes never authorize tickets', () => {
  const vote = { id: 'U06', title: 'Household budgets', score: 1, votes: 1, upvotes: 1, closesAt: 123, github: { prNumber: 547, headSha: 'a'.repeat(40) } };
  const queue = buildQueue({ backlog, votes: [vote] });
  const changed = buildQueue({ backlog, votes: [{ ...vote, github: { ...vote.github, headSha: 'b'.repeat(40) } }] });
  expect(() => reviewDraft(changed, decision(queue))).toThrow();
  expect(queue.entries[0].status).toBe('needs-human-review');
  expect(buildQueue({ backlog, votes: [{ ...vote, score: 2 }] }).revision).not.toBe(queue.revision);
});

test('normal consented collectors feed a read-only local queue without exporting voter keys', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hbl-launch-triage-'));
  const patchPath = join(directory, 'patch.sqlite');
  const player = createPlayerFeedbackHandler({ directory });
  const patch = createPatchVotingHandler({ dbPath: patchPath, secret: 'fixture-secret' });
  const post = (path, body) => new Request('https://test.example' + path, { method: 'POST', headers: { origin: 'https://test.example', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    expect((await player(post('/api/player-feedback', { version: 1, consent: false, kind: 'confusing', moment: 'sharing' }))).status).toBe(400);
    expect((await player(post('/api/player-feedback', { version: 1, consent: true, kind: 'confusing', moment: 'sharing' }))).status).toBe(201);
    expect((await patch(post('/api/patch-votes/suggestions', { consent: false, title: suggestion.title, details: suggestion.details }))).status).toBe(400);
    for (let i = 0; i < 2; i++) expect((await patch(post('/api/patch-votes/suggestions', { consent: true, title: suggestion.title, details: suggestion.details, kind: 'confusing' }))).status).toBe(202);
    const args = { countsPath: join(directory, 'counts.sqlite'), patchPath, backlog };
    const queue = readStores(args);
    const group = queue.entries.find(e => e.category === 'confusing' && e.sources[0].type === 'patch-suggestion');
    expect(group.sources).toHaveLength(2);
    expect(queue.entries.find(e => e.sources[0].type === 'player-count').sources[0].count).toBe(1);
    expect(JSON.stringify(queue)).not.toContain('voter_key');
    expect(JSON.stringify(queue)).not.toContain('hbl_patch_session');
    expect(readStores(args)).toEqual(queue);
    const snapshot = join(directory, 'backlog.json');
    writeFileSync(snapshot, JSON.stringify(backlog));
    const script = new URL('../ops/launch-triage/run.js', import.meta.url).pathname;
    const run = (...args) => Bun.spawnSync([process.execPath, '--no-env-file', script, ...args], { cwd: directory });
    const output = '.hbl-private/queue.json';
    expect(run('prepare', args.countsPath, patchPath, snapshot, output).exitCode).toBe(0);
    expect(JSON.parse(readFileSync(join(directory, output), 'utf8'))).toEqual(queue);
    expect(statSync(join(directory, output)).mode & 0o777).toBe(0o600);
    expect(run('prepare', args.countsPath, patchPath, snapshot, output).exitCode).toBe(1);
    expect(run('prepare', args.countsPath, patchPath, snapshot, 'public.json').exitCode).toBe(1);
    const decisionPath = join(directory, 'decision.json');
    writeFileSync(decisionPath, JSON.stringify({ ...decision(queue), key: group.key }));
    expect(run('review', output, decisionPath, '.hbl-private/draft.json').exitCode).toBe(0);
    expect(readFileSync(join(directory, '.hbl-private/draft.json'), 'utf8')).not.toContain('person@example.com');
    expect(reviewDraft(queue, { ...decision(queue), key: group.key }).title).toBe('Review launch confusing feedback');
  } finally { patch.close(); rmSync(directory, { recursive: true, force: true }); }
});
