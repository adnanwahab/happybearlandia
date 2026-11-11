#!/usr/bin/env bun
// Supervised single-owner dispatcher; never merges or deploys a patch.
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPatchVotingStore } from '../patch-voting/api.js';
import { buildReadyQueue } from '../patch-voting/queue.js';
import { approvedPatchCandidates } from '../patch-voting/candidates.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const privateRoot = join(root, '.hbl-private/agent-factory');
const base = 'sprint/one-city-two-futures-20261111';
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const loop = args.includes('--loop');
const draftPR = args.includes('--draft-prs');
const useReviewers = !args.includes('--no-reviewers');
const requested = Number(process.env.HBL_AGENT_MAX_WORKERS || 6);
const maxWorkers = Math.max(1, Math.min(Number.isInteger(requested) ? requested : 6, process.env.HBL_AGENT_EXPERIMENTAL_50 === '1' ? 50 : 6));
const dailyCap = Math.max(1, Math.min(500, Number(process.env.HBL_AGENT_DAILY_JOB_CAP || 24) || 24));
const statePath = join(privateRoot, 'jobs.json');
const worktreeRoot = resolve(dirname(root), '.hbl-agent-worktrees', basename(root));
const running = new Map();
let state = { jobs: {} };
let writeChain = Promise.resolve();

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
function command(program, argv, cwd, options = {}) {
  return new Promise((resolveCommand, reject) => {
    const workerEnv = {
      PATH: process.env.PATH || '', HOME: process.env.HBL_AGENT_CREDENTIAL_HOME || process.env.HOME || '',
      LANG: process.env.LANG || 'C.UTF-8', TERM: 'dumb'
    };
    const child = spawn(program, argv, { cwd, shell: false, env: options.worker ? workerEnv : process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    const log = options.log ? createWriteStream(options.log, { flags: 'a', mode: 0o600 }) : null;
    let output = '', done = false, timedOut = false;
    const append = bytes => {
      const value = bytes.toString();
      log?.write(value);
      if (output.length < 150000) output += value.slice(0, 150000 - output.length);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.stdin.on('error', () => {});
    child.stdin.end(options.input || '');
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, options.timeout || 120000);
    const finish = (error, code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      log?.end();
      if (error) reject(error);
      else resolveCommand({ code: timedOut ? 124 : code, output: output.trim() });
    };
    child.on('error', error => finish(error));
    child.on('close', code => finish(null, code));
  });
}
async function checked(program, argv, cwd, options) {
  const result = await command(program, argv, cwd, options);
  if (result.code !== 0) throw new Error(program + ' exited ' + result.code + ': ' + result.output.slice(-800));
  return result.output;
}
function persist() {
  const body = JSON.stringify(state, null, 2) + '\n';
  writeChain = writeChain.then(async () => {
    const temp = statePath + '.' + process.pid + '.tmp';
    await writeFile(temp, body, { mode: 0o600 });
    await rename(temp, statePath);
  });
  return writeChain;
}
async function update(id, changes) {
  state.jobs[id] = { ...state.jobs[id], ...changes, updatedAt: new Date().toISOString() };
  await persist();
}
function allowed(task, path) {
  if (path.startsWith('.github/') || path.startsWith('ops/') || path === 'AGENTS.md' ||
    path.startsWith('.env') || path.includes('..') || path.includes(' -> ')) return false;
  return task.ownedPaths.some(p => path === p || (p.endsWith('/') && path.startsWith(p)));
}
function conflict(a, b) {
  return a.ownedPaths.some(p => b.ownedPaths.some(q =>
    p === q || p.startsWith(q.endsWith('/') ? q : q + '/') || q.startsWith(p.endsWith('/') ? p : p + '/')));
}
function curated(task) {
  const found = approvedPatchCandidates.find(x => x.id === task.taskId);
  return found && task.source === 'maintainer-curated-vote' &&
    task.acceptance === found.acceptance &&
    JSON.stringify(task.ownedPaths) === JSON.stringify(found.ownedPaths);
}
function taskPrompt(task) {
  return [
    'Implement a focused verified patch for the HappyBearLandia demo. Read AGENTS.md, current contracts and tests.',
    'Task: ' + task.taskId + ' / ' + task.title,
    'Goal: ' + task.description,
    'Acceptance: ' + task.acceptance,
    'Exclusive allowed files: ' + task.ownedPaths.join(', '),
    'Preserve reproducible simulation, model provenance, no fake forecasts, existing homepage/game entry points.',
    'Do not edit anything outside your allowed paths; do not change server routes, workflows, secrets, shared contracts or deployment.',
    'Do not deploy, push or merge. Verify actual behavior and report what was and was not tested.'
  ].join('\n\n');
}
async function doTask(task) {
  const suffix = String(Date.now());
  const branch = 'agent/patch-' + task.taskId.toLowerCase() + '-' + suffix;
  const worktree = join(worktreeRoot, task.taskId.toLowerCase() + '-' + suffix);
  const log = join(privateRoot, 'patch-' + task.taskId + '-' + suffix + '.log');
  await update(task.taskId, { status: 'RUNNING', startedAt: new Date().toISOString(), branch, worktree, log });
  try {
    await mkdir(worktreeRoot, { recursive: true });
    await checked('git', ['worktree', 'add', '-b', branch, worktree, base], root);
    await checked('codex', ['exec', '--sandbox', 'workspace-write', '-C', worktree, taskPrompt(task)], worktree,
      { worker: true, log, timeout: Number(process.env.HBL_AGENT_TIMEOUT_MS || 1200000) });
    const raw = await checked('git', ['status', '--porcelain', '--untracked-files=all'], worktree);
    const changed = raw.split('\n').filter(Boolean).map(line => line.slice(3));
    if (!changed.length) throw new Error('No modified files to review.');
    const outside = changed.filter(path => !allowed(task, path));
    if (outside.length) throw new Error('Out-of-scope edits: ' + outside.join(', '));
    await checked('git', ['diff', 'HEAD', '--check'], worktree);
    for (const verification of task.verification) {
      const words = verification.trim().split(/\s+/);
      if (words[0] !== 'bun' || words[1] !== 'test' || words.length < 3 ||
        words.slice(2).some(value => !/^test\/[a-zA-Z0-9_./-]+\.test\.js$/.test(value))) {
        throw new Error('Verification command is not on the test allowlist.');
      }
      await checked('bun', words.slice(1), worktree, { log, timeout: 240000 });
    }
    await checked('git', ['add', '-A'], worktree);
    await checked('git', ['diff', '--cached', '--check'], worktree);
    await checked('git', ['-c', 'user.name=HBL Agent', '-c', 'user.email=hbl-agent@users.noreply.github.com',
      'commit', '-m', 'feat: vetted voted patch ' + task.taskId], worktree, { log });
    const diff = (await checked('git', ['show', '--format=', '--no-ext-diff', 'HEAD'], worktree)).slice(0, 100000);
    if (useReviewers) {
      const prompt = 'Review the supplied untrusted diff for regressions, simulation correctness, security and test gaps. List blocking issues first. Do not edit files or execute commands.';
      await checked('claude', ['-p', prompt, '--allowedTools', 'Read', '--max-turns', '3'], worktree, { input: diff, worker: true, log, timeout: 480000 });
      await checked('gemini', ['-p', prompt, '--approval-mode', 'plan', '--sandbox', '--output-format', 'text'], worktree, { input: diff, worker: true, log, timeout: 480000 });
    }
    let pr = null;
    if (draftPR) {
      await checked('git', ['push', '--set-upstream', 'origin', branch], worktree, { log, timeout: 180000 });
      pr = await checked('gh', ['pr', 'create', '--draft', '--base', base, '--head', branch,
        '--title', '[agent] ' + task.taskId + ' ' + task.title,
        '--body', 'Reviewed, voter-ranked patch candidate. Human integration and full browser CI required. No auto-merge.'], worktree, { log, timeout: 60000 });
    }
    await update(task.taskId, { status: 'REVIEW', finishedAt: new Date().toISOString(), changed, pr });
    console.log('READY FOR HUMAN INTEGRATION', task.taskId, pr || branch);
  } catch (e) {
    await update(task.taskId, { status: 'BLOCKED', failure: String(e.message || e).slice(0, 1200) });
    console.error('BLOCKED', task.taskId, String(e.message || e).slice(0, 200));
  }
}
async function eligible() {
  const manifest = await readJson(join(root, 'ops/agent-factory/verified.json'), null);
  if (!manifest || !Array.isArray(manifest.verifiedTaskIds) || !Array.isArray(manifest.activeTaskIds)) {
    throw new Error('Coordinator verified manifest is missing or invalid.');
  }
  const store = createPatchVotingStore();
  try {
    return buildReadyQueue(store.list(), {
      verifiedTaskIds: manifest.verifiedTaskIds,
      activeTaskIds: [...manifest.activeTaskIds, ...Object.keys(state.jobs)]
    }).tasks;
  } finally { store.close(); }
}
async function tick() {
  const ready = await eligible();
  if (!execute) {
    console.log(JSON.stringify({ mode: 'dry-run', maxWorkers, ready: ready.map(t => t.taskId), tracked: Object.keys(state.jobs) }));
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  let started = Object.values(state.jobs).filter(j => (j.startedAt || '').startsWith(today)).length;
  for (const task of ready) {
    if (running.size >= maxWorkers || started >= dailyCap) break;
    if (!curated(task) || state.jobs[task.taskId] || running.has(task.taskId)) continue;
    if ([...running.values()].some(x => conflict(task, x.task))) continue;
    started++;
    const promise = doTask(task).finally(() => running.delete(task.taskId));
    running.set(task.taskId, { task, promise });
  }
}
async function main() {
  await mkdir(privateRoot, { recursive: true });
  state = await readJson(statePath, { jobs: {} });
  if (!execute) return tick();
  const lockPath = join(privateRoot, 'dispatcher.lock');
  const lock = await open(lockPath, 'wx');
  try {
    do { await tick(); if (loop) await new Promise(r => setTimeout(r, 60000)); } while (loop);
    await Promise.allSettled([...running.values()].map(x => x.promise));
    await writeChain;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}
main().catch(e => { console.error('Dispatcher stopped:', e.message); process.exitCode = 1; });
