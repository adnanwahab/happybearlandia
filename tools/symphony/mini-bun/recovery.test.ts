import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishDraft, type Command } from './publication';
import { reconcile } from './reconcile';
import { createTaskWorkspace } from './workspace';

for (const boundary of ['commit', 'push', 'create', 'success', 'advanced-base', 'new-worktree']) test(`publication resumes after ${boundary}`, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mini-recovery-'));
  const repo = path.join(dir, 'repo'), remote = path.join(dir, 'remote.git');
  const real: Command = (bin, args, cwd) => {
    const p = Bun.spawnSync([bin, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
    return { code: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
  };
  const git = (...args: string[]) => { const r = real('git', args, repo); if (r.code) throw Error(r.stderr); return r.stdout.trim(); };
  try {
    real('git', ['init', '--bare', remote], dir);
    real('git', ['init', '-b', 'main', repo], dir);
    git('config', 'user.email', 'fixture@example.com'); git('config', 'user.name', 'Fixture');
    writeFileSync(path.join(repo, 'a'), 'base'); git('add', '.'); git('commit', '-m', 'base');
    git('remote', 'add', 'origin', remote); git('push', '-u', 'origin', 'main'); git('checkout', '-b', 'mini/SHE-1');
    writeFileSync(path.join(repo, 'a'), 'changed');
    let pr: any = null, failed = false, creates = 0;
    const url = 'https://github.com/test/repo/pull/1';
    const command: Command = (bin, args, cwd) => {
      if (bin === 'gh') {
        if (args[0] === 'auth') return { code: 0, stdout: '', stderr: '' };
        if (args[1] === 'list') return { code: 0, stdout: JSON.stringify(pr ? [pr] : []), stderr: '' };
        creates++; pr = { url, state: 'OPEN', headRefName: 'mini/SHE-1', baseRefName: 'main' };
        if (boundary === 'create' && !failed) { failed = true; return { code: 1, stdout: '', stderr: 'lost response' }; }
        return { code: 0, stdout: url, stderr: '' };
      }
      const result = real(bin, args, cwd);
      if (args[0] === boundary && !failed) { failed = true; return { code: 1, stdout: '', stderr: 'interrupted after success' }; }
      return result;
    };
    if (boundary === 'advanced-base' || boundary === 'new-worktree') {
      const stale = git('rev-parse', 'origin/main');
      git('add', '.'); git('commit', '-m', 'already integrated remotely');
      git('push', 'origin', 'HEAD:main');
      git('update-ref', 'refs/remotes/origin/main', stale);
      if (boundary === 'new-worktree') {
        const currentRemote = git('rev-parse', 'HEAD');
        git('checkout', 'main');
        const sourceHead = git('rev-parse', 'HEAD');
        expect(sourceHead).not.toBe(currentRemote);
        const workspace = path.join(dir, 'fresh-task');
        expect(createTaskWorkspace(real, repo, workspace, 'SHE-2', 'main')).toBe(currentRemote);
        expect(real('git', ['rev-parse', 'HEAD'], workspace).stdout.trim()).toBe(currentRemote);
        expect(git('rev-parse', 'HEAD')).toBe(sourceHead);
        return;
      }
      expect(git('rev-list', '--count', 'origin/main..HEAD')).toBe('1');
      expect(() => publishDraft(command, repo, 'SHE-1', 'main', 'title', 'body')).toThrow('produced no changes to publish');
      expect(git('rev-list', '--count', 'origin/main..HEAD')).toBe('0');
      expect(creates).toBe(0);
      return;
    }
    if (boundary !== 'success') expect(() => publishDraft(command, repo, 'SHE-1', 'main', 'title', 'body')).toThrow();
    expect(publishDraft(command, repo, 'SHE-1', 'main', 'title', 'body')).toBe(url);
    expect(git('rev-list', '--count', 'origin/main..HEAD')).toBe('1');
    expect(creates).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reconciliation holds merged, review and no_changes work and preserves other tasks/state', () => {
  const issue = (id: string, status = 'Backlog') => ({ id, title: 'Implement feature', description: 'Full acceptance criteria', status, url: 'https://linear.app/test' });
  const state = { 'SHE-3': { status: 'no_changes' } };
  const original = JSON.stringify(state);
  const result = reconcile([issue('SHE-1'), issue('SHE-2', 'In Review'), issue('SHE-3'), issue('SHE-4')],
    [{ headRefName: 'mini/SHE-1', state: 'MERGED', url: 'https://github.com/test/repo/pull/1' }],
    [{ id: 'SHE-99', prompt: 'Unrelated task', enabled: true }], state);
  expect(result.report.map(r => r.reason)).toEqual(['merged_acceptance_review', 'review_required', 'no_changes_review_required', 'ready_for_triage']);
  expect(result.tasks[0].enabled).toBe(true);
  expect(result.tasks.slice(1).every(t => !t.enabled)).toBe(true);
  expect(JSON.stringify(state)).toBe(original);
  expect(() => reconcile([{ ...issue('SHE-5'), description: '(truncated, use `get_issue` for full description)' }], [], [], {})).toThrow();
});

test('closed PRs and unreviewed edits cannot be silently published', () => {
  let mutations = 0;
  const command: Command = (bin, args) => {
    if (['push', 'commit', 'add', 'create'].includes(args[0]) || args[1] === 'create') mutations++;
    const stdout = bin === 'git' && args[0] === 'branch' ? 'mini/SHE-1' :
      args[1] === 'list' ? JSON.stringify([{ url: 'https://github.com/test/repo/pull/1', state: 'CLOSED', headRefName: 'mini/SHE-1', baseRefName: 'main' }]) : '';
    return { code: 0, stdout, stderr: '' };
  };
  expect(() => publishDraft(command, '/unused', 'SHE-1', 'main', 'title', 'body')).toThrow('closed without merging');
  expect(mutations).toBe(0);
});

import { runnable, queueSummary } from './queue';
test('idle summary distinguishes enabled from runnable and explicit retries', () => {
  const tasks = [
    { id: 'done', enabled: true, linearStatusType: 'completed' },
    { id: 'new', enabled: false },
    { id: 'old', enabled: true },
    { id: 'retry', enabled: true, retry: true },
  ];
  const state = { old: { status: 'pr_created' }, retry: { status: 'no_changes' } };
  expect(queueSummary(tasks, state)).toEqual({ runnable: 1, disabled: 1, terminal: 1, priorAttempts: 1, running: 0 });
  expect(runnable(tasks[3], state, new Set(['retry']))).toBe(false);
  expect(runnable(tasks[2], state, new Set())).toBe(false);
});

import { approveRemaining } from './approved-queue';
import { miniIssueIdentifier } from '../../../scripts/mini-issue-identifier.mjs';
test('explicit follow-ups preserve history, skip open/active deliveries, disable deleted tasks and are idempotent', () => {
  const issues = [1,2,3,4].map(n => ({ id: `SHE-${n}`, title: 'Work', description: 'Acceptance', status: 'Todo', statusType: 'unstarted', url: 'https://linear.app/test' }));
  const state = { 'SHE-1': { status: 'pr_created' }, 'SHE-2': { status: 'running' }, 'SHE-3': { status: 'pr_created' }, 'SHE-99': { status: 'no_changes' } };
  const tasks = [1,2,3,4,99].map(n => ({ id: `SHE-${n}`, enabled: true }));
  const prs = [{ headRefName: 'mini/SHE-1', state: 'MERGED' }, { headRefName: 'mini/SHE-3', state: 'OPEN' }];
  const original = JSON.stringify(state);
  const result = approveRemaining(issues, prs, tasks, state);
  expect(result.report.map(r => r.action)).toEqual(['follow_up','active','open_pr','enabled']);
  expect(result.tasks.find(t => t.id === 'SHE-1')?.enabled).toBe(false);
  expect(result.tasks.find(t => t.id === 'SHE-1-r2')?.enabled).toBe(true);
  expect(result.tasks.find(t => t.id === 'SHE-99')?.enabled).toBe(false);
  expect(result.tasks.find(t => t.id === 'SHE-4')?.prompt).toContain('docs/reviews/SHE-4.md');
  expect(approveRemaining(issues, prs, result.tasks, state).tasks).toEqual(result.tasks);
  expect(JSON.stringify(state)).toBe(original);
  expect(tasks.every(t => t.enabled)).toBe(true);
});

test('follow-up branch sync maps only exact Mini Symphony branches to original issues', () => {
  expect(miniIssueIdentifier('mini/SHE-137-r2')).toBe('SHE-137');
  expect(miniIssueIdentifier('mini/SHE-137')).toBe('SHE-137');
  for (const branch of ['other/SHE-137-r2','mini/SHE-137-r0','mini/SHE-137-r2-extra','mini/SHE-137-other']) expect(miniIssueIdentifier(branch)).toBeNull();
});

test('activation CLI dry-run leaves queue/state intact and explicit write is repeatable', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mini-activation-'));
  try {
    const tasks = JSON.stringify([{ id: 'SHE-1', enabled: true }, { id: 'SHE-99', enabled: true }]);
    const state = JSON.stringify({ 'SHE-1': { status: 'pr_created' } });
    writeFileSync(path.join(dir, 'tasks.json'), tasks); writeFileSync(path.join(dir, 'state.json'), state);
    writeFileSync(path.join(dir, 'issues.json'), JSON.stringify([{ id: 'SHE-1', title: 'Feature', status: 'Todo', statusType: 'unstarted', description: '## Mini Symphony execution approval — November 12, 2026', labels: ['hbl-agent-ready','hbl-coordinator-approved'] }]));
    writeFileSync(path.join(dir, 'prs.json'), '[]');
    const argv = [process.execPath, path.resolve('tools/symphony/mini-bun/activate-approved.ts'), 'issues.json', '--prs', 'prs.json'];
    const dry = Bun.spawnSync(argv, { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
    expect(dry.exitCode).toBe(0);
    expect(require('node:fs').readFileSync(path.join(dir, 'tasks.json'), 'utf8')).toBe(tasks);
    for (let n = 0; n < 2; n++) expect(Bun.spawnSync([...argv, '--write'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' }).exitCode).toBe(0);
    const saved = JSON.parse(require('node:fs').readFileSync(path.join(dir, 'tasks.json'), 'utf8'));
    expect(saved.filter(t => t.id === 'SHE-1-r2')).toHaveLength(1);
    expect(saved.find(t => t.id === 'SHE-99').enabled).toBe(false);
    expect(require('node:fs').readFileSync(path.join(dir, 'state.json'), 'utf8')).toBe(state);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
