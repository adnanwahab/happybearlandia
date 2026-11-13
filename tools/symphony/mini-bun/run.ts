#!/usr/bin/env bun
/** Single coordinator, bounded Codex workers, isolated Git worktrees. */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

import { portFailureEvidence, shouldAutoDebug, autoDebugPrompt, parseAutoDebugResult } from './auto-debug';
import { publishDraft } from './publication';
import { createSessionTelemetry } from './telemetry';
import { createHash } from 'node:crypto';
import { fetchProjectIssues } from './linear-import';
import { refreshRunningProject } from './refresh';
import { runnable, queueSummary } from './queue';
import { createTaskWorkspace } from './workspace';
import { readProject, githubIdentity, validateProjectTasks, projectBinding, validateBinding, workerEnvironment } from './project';

type Task = { id: string; prompt: string; enabled?: boolean; retry?: boolean; linearStatus?: string; linearStatusType?: string; url?: string; holdReason?: string | null };
type Entry = { status: 'running' | 'needs_review' | 'failed' | 'interrupted' | 'publishing' | 'pr_created' | 'publish_failed' | 'no_changes'; attempt: number; startedAt: string; finishedAt?: string; exitCode?: number | null; log?: string; pullRequestUrl?: string; publishError?: string; sessionId?: string };
const argv = process.argv.slice(2), configIndex = argv.indexOf('--config');
const project = configIndex >= 0 ? readProject(argv[configIndex + 1] ?? '') : undefined;
const autoDebug = argv.includes('--auto-debug');
const root = project?.dataDirectory ?? process.cwd();
const repo = project?.repository ?? path.resolve(argv[0] ?? '');
if ((!project && !argv[0]) || !existsSync(path.join(repo, '.git'))) { console.error('Usage: bun run run.ts /path/to/repository OR --config profile.json [--check] [--auto-debug]'); process.exit(2); }
if (project) {
  const origin = Bun.spawnSync(['git', '-C', repo, 'remote', 'get-url', 'origin'], { stdout: 'pipe', stderr: 'pipe' });
  if (origin.exitCode !== 0 || githubIdentity(origin.stdout.toString()) !== project.githubRepository.toLowerCase()) throw Error('Repository origin does not match project profile');
}
const tasksPath = path.join(root, 'tasks.json'), statePath = path.join(root, 'state.json');
const workspaces = path.join(root, 'workspaces'), logs = path.join(root, 'logs'), lock = path.join(root, '.runner.lock');
const timeoutMs = Number(process.env.MINI_SYMPHONY_TIMEOUT_MS ?? 3600000);
const concurrency = Number(process.env.MINI_SYMPHONY_WORKERS ?? 1);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error('Workers must be an integer from 1 to 10; timeout must be positive');
const prBase = project?.baseBranch ?? process.env.MINI_SYMPHONY_PR_BASE ?? new TextDecoder().decode(Bun.spawnSync(['git', '-C', repo, 'branch', '--show-current'], { stdout: 'pipe' }).stdout).trim();
const children = new Set<ChildProcess>();
let stopping = false;
let stopReason = 'completed';
let telemetry: Awaited<ReturnType<typeof createSessionTelemetry>> | undefined;
function stop(signal: NodeJS.Signals) {
  if (!stopping) {
    stopReason = `external_${signal}`;
    void telemetry?.event('operator_intervention', `External ${signal} received (operator or supervisor).`, {reason: stopReason});
  }
  stopping = true;
  for (const child of children) terminateChild(child);
}
const killGraceMs = Number(process.env.MINI_SYMPHONY_KILL_GRACE_MS ?? 10000);
if (!Number.isFinite(killGraceMs) || killGraceMs <= 0 || killGraceMs > 60000) throw Error('Kill grace must be positive and at most60000ms');
const terminationTimers = new Map<ChildProcess, ReturnType<typeof setTimeout>>();
function signalChild(child: ChildProcess, signal: NodeJS.Signals) {
  try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
  catch { try { child.kill(signal); } catch {} }
}
function terminateChild(child: ChildProcess) {
  if (terminationTimers.has(child)) return;
  signalChild(child,'SIGTERM');
  const timer=setTimeout(()=>{void telemetry?.event('worker_force_stopped','Worker did not exit during the termination grace period; forcing process-group termination.');signalChild(child,'SIGKILL');},killGraceMs);
  timer.unref();terminationTimers.set(child,timer);
  child.once('close',()=>{clearTimeout(timer);terminationTimers.delete(child);});
}
process.on('SIGINT', () => stop('SIGINT')); process.on('SIGTERM', () => stop('SIGTERM'));
let saveQueue = Promise.resolve();
async function save(state: Record<string, Entry>) {
  const snapshot = JSON.stringify(state, null, 2) + '\n';
  const write = saveQueue.then(async () => {
    const tmp = `${statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, snapshot, { mode: 0o600 });
    await rename(tmp, statePath);
  });
  saveQueue = write.catch(() => {});
  await write;
}
async function logLine(file: string, line: string) { await appendFile(file, `[${new Date().toISOString()}] ${line}\n`); }
function command(bin: string, args: string[], cwd: string) {
  const result = Bun.spawnSync([bin, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  return { code: result.exitCode, stdout: new TextDecoder().decode(result.stdout), stderr: new TextDecoder().decode(result.stderr) };
}
async function publishTask(task: Task, workspace: string, log: string) {
  telemetry?.activity(task.id, 'publishing');
  await telemetry?.event('publication_started', 'Checking and publishing a draft PR.', {}, task.id);
  const entry = state[task.id]; entry.status = 'publishing'; entry.sessionId=telemetry?.sessionId; await save(state);
  await logLine(log, `Preparing draft PR: base=${prBase}, branch=mini/${task.id}`);
  const title = `[${task.id}] ${task.prompt.split('\n')[0].replace(/^Linear issue [^:]+:\s*/, '').slice(0, 180)}`;
  const body = [
    `Automated draft PR for task ${task.id}.`,
    task.url ? `Linear issue: ${task.url}` : '',
    '',
    'Codex CLI exited with code 0. This confirms process completion only; tests and acceptance criteria still require review.',
  ].filter(Boolean).join('\n');
  let reused = false;
  const url = publishDraft(command, workspace, task.id, prBase, title, body, result => { reused = result.reused; });
  entry.status = 'pr_created'; entry.pullRequestUrl = url; entry.publishError = undefined;
  await save(state); await telemetry?.event('pr_created', reused ? 'Existing PR reconciled; no new PR created.' : 'New draft PR published; review and acceptance are pending.', {url, reused}, task.id); await logLine(log, `Draft PR created: ${url}`); console.log(`[${task.id}] draft PR: ${url}`);
}
// Check routing before creating a lock, rewriting state, or launching a worker.
if (project) {
  const bindingPath = path.join(root, 'project-binding.json');
  if (existsSync(bindingPath)) validateBinding(JSON.parse(await readFile(bindingPath, 'utf8')), project);
  validateProjectTasks(JSON.parse(await readFile(tasksPath, 'utf8')), project);
}
if (argv.includes('--check')) {
  const tasks = JSON.parse(await readFile(tasksPath, 'utf8'));
  validateProjectTasks(tasks, project);
  const snapshot = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : {};
  console.log(JSON.stringify({ project: project?.name ?? null, repository: repo, githubRepository: project?.githubRepository ?? null, linearProjectId: project?.linearProjectId ?? null, base: prBase, dataDirectory: root, concurrency, autoDebug, queue: queueSummary(tasks, snapshot) }, null, 2));
  process.exit(0);
}
await mkdir(workspaces, { recursive: true }); await mkdir(logs, { recursive: true });
async function acquireLock() {
  try {
    await mkdir(lock);
    await writeFile(path.join(lock, 'pid'), String(process.pid));
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const pidFile = path.join(lock, 'pid');
  let owner = '';
  try { owner = (await readFile(pidFile, 'utf8')).trim(); } catch {}
  const pid = /^\d+$/.test(owner) ? Number(owner) : 0;
  if (pid <= 1) throw Error('Runner lock has no valid owner PID; inspect it before recovery.');
  let liveRunner = true;
  try { process.kill(pid, 0); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') liveRunner = false; }
  if (liveRunner) throw Error(`Mini Symphony PID ${pid} still owns .runner.lock; stop it before starting another.`);
  const stale = `${lock}.stale-${crypto.randomUUID()}`;
  try { await rename(lock, stale); }
  catch { throw Error('Another process is recovering .runner.lock; retry startup in a moment.'); }
  await import('node:fs/promises').then(fs => fs.rm(stale, { recursive: true, force: true }));
  await mkdir(lock);
  await writeFile(pidFile, String(process.pid));
}
try { await acquireLock(); if (project) await writeFile(path.join(root, 'project-binding.json'), JSON.stringify(projectBinding(project), null, 2) + '\n', { mode: 0o600 }); } catch (error) { console.error(String(error)); process.exit(1); }
function releaseLockSync() {
  try {
    const owner = readFileSync(path.join(lock, 'pid'), 'utf8').trim();
    if (owner === String(process.pid)) rmSync(lock, { recursive: true, force: true });
  } catch {}
}
// Runs for normal exits and uncaught exceptions. SIGKILL cannot run cleanup;
// acquireLock() detects and recovers that stale PID on the next launch.
process.on('exit', releaseLockSync);
const state: Record<string, Entry> = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : {};
for (const entry of Object.values(state)) if (entry.status === 'running') { entry.status = 'interrupted'; entry.finishedAt = new Date().toISOString(); }
await save(state);
try { telemetry = await createSessionTelemetry({root, name: project?.name ?? 'HappyBearLandia', repository: project?.githubRepository ?? 'adnanwahab/happybearlandia'}); }
catch { console.error('Session logging unavailable; this run cannot establish the25-hour goal. Check disk space and permissions.'); }
await telemetry?.event('configuration', 'Coordinator configured. Each Codex task has its own timeout; the session has no 1-hour limit.', {timeoutMs, workers: concurrency, autoDebug});
if (telemetry) console.log(`Session ${telemetry.sessionId}; text log: ${path.join(telemetry.dir, 'session.log')}`);
console.log(`Mini Symphony watching ${tasksPath}; source ${repo}`);
console.log(`Concurrency: ${concurrency}; Codex timeout: ${Math.round(timeoutMs / 1000)}s. Logs: ${logs}; auto-debug: ${autoDebug ? 'on (one port-repair pass)' : 'off'}`);
let lastBoardSync = 0;
let lastTaskDigest = createHash('sha256').update(await readFile(tasksPath,'utf8')).digest('hex');
let lastQueueDigest = '';
function waitingExplanation(tasks: Task[]) {
  const reasons=[...new Set(tasks.filter(t=>t.enabled!==true&&t.holdReason).map(t=>t.holdReason!))];
  if(reasons.length)return `Held: ${reasons.slice(0,3).join(' ')}${reasons.length>3?' Additional holds are recorded in tasks.json.':''}`;
  return 'No new eligible work. Prior PRs/results require review; explicit operator-disabled tasks remain disabled.';
}
async function observeQueue(tasks: Task[]) {
  const digest = createHash('sha256').update(await readFile(tasksPath,'utf8')).digest('hex');
  if (digest !== lastTaskDigest) {
    await telemetry?.event('operator_intervention', 'Task queue changed outside this runner; operator or another automation may have edited it.', {reason:'external_queue_change'});
    lastTaskDigest = digest;
  }
  const counts=queueSummary(tasks,state,claimedThisRun);
  const signature=JSON.stringify([counts,waitingExplanation(tasks)]);
  if(signature!==lastQueueDigest){lastQueueDigest=signature;await telemetry?.event('queue_snapshot', counts.runnable ? `${counts.runnable} runnable task(s) remain.` : `No runnable tasks. ${waitingExplanation(tasks)}`, counts);}
}
const syncInterval = project?.syncIntervalMs;
async function syncBoardIfDue(force = false) {
  if (!project || !syncInterval || !process.env.LINEAR_API_KEY) return;
  if (!force && Date.now() - lastBoardSync < syncInterval) return;
  lastBoardSync = Date.now();
  telemetry?.background('syncing');
  await telemetry?.event('sync_started', 'Refreshing the configured Linear board and existing PRs.');
  try {
    const result = await refreshRunningProject(project, state, async () => {
      const issues = await fetchProjectIssues(project, process.env.LINEAR_API_KEY!);
      const prs = command('gh', ['pr','list','--repo',project.githubRepository,'--state','open','--limit','1000','--json','headRefName,title,body,state,url'], repo);
      if (prs.code !== 0) throw Error('Could not check existing PRs; local queue retained');
      return { issues, prs: JSON.parse(prs.stdout) };
    });
    await save(state);
    lastTaskDigest = createHash('sha256').update(await readFile(tasksPath,'utf8')).digest('hex');
    await telemetry?.event('sync_finished', `Linear refresh: ${result.issues} issues, ${result.enabled} enabled.`);
    console.log(`Linear refresh: ${result.issues} issues, ${result.enabled} enabled.`);
  } catch (error) { await telemetry?.event('sync_failed', `Linear refresh failed; local queue retained: ${error}`); console.error(`Linear refresh failed; local queue retained: ${error}`); }
  finally { telemetry?.background('waiting'); }
}
if (project && syncInterval) console.log(process.env.LINEAR_API_KEY ? `Linear refresh every ${syncInterval / 1000}s (between tasks).` : 'Linear refresh unavailable: LINEAR_API_KEY missing; using the imported local queue.');
await syncBoardIfDue(true);
// Reconcile successful prior runs that were waiting for GitHub credentials or publication.
try {
  const pending: Task[] = JSON.parse(await readFile(tasksPath, 'utf8'));
  validateProjectTasks(pending, project);
  for (const task of pending.filter(t => t.enabled === true && !['completed', 'canceled', 'duplicate'].includes(t.linearStatusType ?? '') && ['needs_review', 'publish_failed', 'publishing'].includes(state[t.id]?.status ?? '') && existsSync(path.join(workspaces, t.id)))) {
    if(stopping)break;
    const workspace = path.join(workspaces, task.id), log = path.join(logs, `${task.id}.log`);
    try { console.log(`[${task.id}] retrying draft PR publication`); await publishTask(task, workspace, log); }
    catch (error) {
      const noChanges = String(error).includes('produced no changes to publish');
      state[task.id] = { ...state[task.id], status: noChanges ? 'no_changes' : 'publish_failed', publishError: String(error), finishedAt: new Date().toISOString() };
      await save(state); await logLine(log, `PR publishing ${noChanges ? 'skipped' : 'failed'}: ${error}`);
      await telemetry?.event(noChanges ? 'no_changes' : 'publish_failed', `PR publication ${noChanges ? 'skipped' : 'failed'}: ${error}`, {reason:String(error)}, task.id);
      console.error(`[${task.id}] PR publishing ${noChanges ? 'skipped' : 'failed'}: ${error}`);
    } finally { telemetry?.activity(task.id, null); }
  }
} catch (error) { await telemetry?.event('recovery_failed', `Unable to reconcile pending PRs: ${error}`); console.error(`Unable to reconcile pending PRs: ${error}`); }
let idleNotice = 0;
const claimedThisRun = new Set<string>();
async function runTask(task: Task) {
  const workspace = path.join(workspaces, task.id), log = path.join(logs, `${task.id}.log`);
  if (existsSync(workspace)) {
    const currentBranch = command('git', ['branch', '--show-current'], workspace);
    if (currentBranch.code !== 0 || currentBranch.stdout.trim() !== `mini/${task.id}`) {
      state[task.id] = { ...state[task.id], status: 'failed', finishedAt: new Date().toISOString(), log: path.relative(root, log) };
      await save(state); await telemetry?.event('task_failed', `Cannot resume: expected branch mini/${task.id}, found ${currentBranch.stdout.trim() || 'unknown'}.`, {}, task.id); await logLine(log, `Cannot resume: expected branch mini/${task.id}, found ${currentBranch.stdout.trim() || 'unknown'}`); return;
    }
    await logLine(log, 'Resuming in the existing task worktree; preserving prior edits.');
  } else {
    try {
      const baseCommit = createTaskWorkspace(command, repo, workspace, task.id, prBase);
      await logLine(log, `Created worktree from current origin/${prBase}: ${baseCommit}`);
    } catch (error) {
      state[task.id] = { ...state[task.id], status: 'failed', finishedAt: new Date().toISOString(), log: path.relative(root, log) };
      await save(state); await telemetry?.event('task_failed', `Worktree preparation failed: ${error}`, {}, task.id); await logLine(log, `Git worktree creation failed: ${error}`);
      console.error(`[${task.id}] worktree creation failed: ${error}`); return;
    }
  }
  const startedAt = new Date().toISOString();
  state[task.id] = { ...state[task.id], status: 'running', attempt: state[task.id]?.attempt ?? 1, startedAt, log: path.relative(root, log) }; await save(state);
  const deadline=Date.now()+timeoutMs;
  let code:number|null=null,timedOut=false,spawnError='',evidence='',scanTail='',debugBlocked=false;
  for(let pass=0;pass<2;pass++) {
    const resultFile=path.join(logs, `${task.id}${pass ? '.autodebug.'+telemetry?.sessionId : ''}.result.md`);
    if(pass) {
      await logLine(log,'AUTO-DEBUG: one port-conflict repair pass; original transcript/result preserved.');
      await telemetry?.event('auto_debug_started','Port conflict detected; starting one bounded repair and validation pass.',{pass:1},task.id);
    }
    const bin = process.env.CODEX_BIN ?? 'codex', args = ['--ask-for-approval', 'never', 'exec', '--sandbox', 'workspace-write', '--output-last-message', resultFile, pass === 0 ? task.prompt : autoDebugPrompt(task.prompt, evidence)];
    await logLine(log, `Launching Codex CLI: ${bin} exec --sandbox workspace-write`);
    await logLine(log, `Prompt: ${task.prompt.split('\n')[0]}`);
    console.log(`[${task.id}] launching Codex; output -> ${path.relative(root, log)}`);
    if (stopping) { state[task.id]={...state[task.id],status:'interrupted',finishedAt:new Date().toISOString()};await save(state);return; }
    const child = spawn(bin, args, { cwd: workspace, detached:process.platform!=='win32', stdio: ['ignore', 'pipe', 'pipe'], ...(project ? { env: workerEnvironment() } : {}) }); children.add(child);
    let outputQueue = Promise.resolve();
    const output = (chunk: Buffer) => {
      const line = chunk.toString();
      scanTail=(scanTail+line).slice(-16384);
      const found=portFailureEvidence(scanTail);if(found)evidence=found;
      outputQueue = outputQueue.then(() => appendFile(log, line));
      process.stdout.write(`[${task.id}] ${line}`);
    };
    child.stdout?.on('data', output); child.stderr?.on('data', output);
    timedOut = false; spawnError = ''; let lastOutputNotice = 0;
    const reportOutput = (chunk: Buffer) => {
      if (Date.now() - lastOutputNotice >= 15000) { lastOutputNotice = Date.now(); void telemetry?.event('task_output', 'Codex output received (raw transcript retained in the private task log).', {bytes:chunk.byteLength}, task.id); }
    };
    child.stdout?.on('data', reportOutput); child.stderr?.on('data', reportOutput);
    const timer = setTimeout(() => { timedOut = true; void telemetry?.event('task_timeout', 'Task exceeded its Codex timeout; requesting termination.', {timeoutMs}, task.id); terminateChild(child); }, Math.max(1, deadline-Date.now()));
    code = await new Promise(resolve => { child.once('close', resolve); child.once('error', error => { spawnError=error.message; resolve(null); }); });
    clearTimeout(timer); children.delete(child);
    await outputQueue;
    if(pass) {
      const result=await readFile(resultFile,'utf8').catch(()=> '');
      debugBlocked=code!==0||!parseAutoDebugResult(result);
      await telemetry?.event('auto_debug_finished',debugBlocked?'Port recovery blocked or unverified; publication held.':'Worker reports port recovery validation passed; normal draft review still required.',{passed:!debugBlocked},task.id);
      break;
    }
    if(!shouldAutoDebug({enabled:autoDebug,evidence,pass,stopping,timedOut,spawnError,remainingMs:deadline-Date.now()})) {
      if(autoDebug && evidence && deadline<=Date.now())debugBlocked=true;
      break;
    }
  }
  const status = stopping ? 'interrupted' : timedOut || debugBlocked ? 'failed' : code === 0 ? 'needs_review' : 'failed';
  state[task.id] = { ...state[task.id], status, exitCode: code, finishedAt: new Date().toISOString() }; await save(state);
  await telemetry?.event('worker_finished', `Codex process finished: ${status}. ${timedOut ? 'Task timeout reached.' : spawnError ? 'Could not start Codex: ' + spawnError : code !== 0 ? 'Inspect the private task transcript for process errors.' : 'Exit zero does not verify tests or acceptance.'}`, {status, code, reason: timedOut ? 'timeout' : spawnError || 'process_exit'}, task.id);
  await logLine(log, `Codex finished: ${status}, exit ${code ?? 'unknown'}`);
  console.log(`[${task.id}] finished: ${status} (exit ${code ?? 'unknown'})`);
  if (status === 'needs_review') {
    try { await publishTask(task, workspace, log); }
    catch (error) {
      const noChanges = String(error).includes('produced no changes to publish');
      state[task.id] = { ...state[task.id], status: noChanges ? 'no_changes' : 'publish_failed', publishError: String(error), finishedAt: new Date().toISOString() };
      await save(state); await logLine(log, `PR publishing ${noChanges ? 'skipped' : 'failed'}: ${error}`);
      await telemetry?.event(noChanges ? 'no_changes' : 'publish_failed', `PR publication ${noChanges ? 'skipped' : 'failed'}: ${error}`, {reason:String(error)}, task.id);
      console.error(`[${task.id}] PR publishing ${noChanges ? 'skipped' : 'failed'}: ${error}`);
    }
  }
}
async function worker(slot: number) {
  while (!stopping) {
    if (slot === 0) await syncBoardIfDue();
    if (stopping) return;
    let tasks: Task[];
    try { tasks = JSON.parse(await readFile(tasksPath, 'utf8')); }
    catch (error) { stopReason='queue_read_error';await telemetry?.event('queue_error','Cannot read tasks.json; coordinator stopping.');console.error(`Cannot read tasks.json: ${error}`); process.exitCode=1; stopping = true; return; }
    try { validateProjectTasks(tasks, project); }
    catch (error) { stopReason='queue_validation_error';await telemetry?.event('queue_error','Task validation failed; coordinator stopping.');console.error(String(error)); process.exitCode=1; stopping = true; return; }
    // Synchronous claim occurs before any await, so workers in this process cannot duplicate tasks.
    await observeQueue(tasks);
    const task = tasks.find(t => runnable(t, state, claimedThisRun));
    if (!task) {
      if (slot === 0 && idleNotice++ % 20 === 0) {
        const q = queueSummary(tasks, state, claimedThisRun);
        console.log(`Waiting: ${q.runnable} runnable, ${q.disabled} disabled, ${q.terminal} terminal, ${q.priorAttempts} prior attempts/review, ${q.running} running. ${waitingExplanation(tasks)}`);
      }
      await Bun.sleep(3000); continue;
    }
    // Reserve in memory before awaiting workspace creation/state I/O.
    claimedThisRun.add(task.id);
    const prior = state[task.id];
    state[task.id] = { ...prior, status: 'running', sessionId:telemetry?.sessionId, attempt: (prior?.attempt ?? 0) + 1, startedAt: new Date().toISOString(), finishedAt: undefined };
    telemetry?.activity(task.id, 'working');
    await telemetry?.event('task_started', 'Preparing the isolated worktree and starting Codex.', {attempt:state[task.id].attempt}, task.id);
    try { await runTask(task); }
    finally {
      const result=state[task.id];
      await telemetry?.event('task_finished', `Task attempt ended: ${result.status}.`, {status:result.status, code:result.exitCode, attempt:result.attempt}, task.id);
      telemetry?.activity(task.id, null);
    }
  }
}
const workers = Array.from({ length: concurrency }, (_, i) => worker(i));
try { await Promise.all(workers); }
catch(error) { stopReason='coordinator_error';stopping=true;for(const child of children)terminateChild(child); await telemetry?.event('coordinator_error', `Coordinator stopped after an error: ${error}`);await Promise.allSettled(workers);process.exitCode=1; }
finally { stopping=true;for(const child of children)terminateChild(child); await telemetry?.stop(stopReason); await Bun.sleep(100); releaseLockSync(); }
