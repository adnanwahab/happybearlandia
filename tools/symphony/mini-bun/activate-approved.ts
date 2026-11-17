import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { approveRemaining } from './approved-queue';
const args = process.argv.slice(2);
const issuesPath = args.find(a => !a.startsWith('--'));
if (!issuesPath || !args.includes('--prs')) throw Error('Usage: bun activate-approved.ts issues.json --prs prs.json [--write]');
const issues = JSON.parse(await readFile(issuesPath, 'utf8'));
const prs = JSON.parse(await readFile(args[args.indexOf('--prs') + 1], 'utf8'));
if (!Array.isArray(issues) || issues.some(i => !/^SHE-\d+$/.test(i.id) || !i.description?.includes('## Mini Symphony execution approval — November 12, 2026') || !i.labels?.includes('hbl-agent-ready') || !i.labels?.includes('hbl-coordinator-approved'))) throw Error('Full issue descriptions and explicit execution approval labels required');
const before = await readFile('tasks.json', 'utf8');
const tasks = JSON.parse(before), state = JSON.parse(await readFile('state.json', 'utf8'));
const result = approveRemaining(issues, prs, tasks, state);
if (args.includes('--write')) {
  if (new Set(result.tasks.map(t => t.id)).size !== result.tasks.length) throw Error('Duplicate task IDs');
  const tmp = `tasks.json.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(result.tasks, null, 2) + '\n', { mode: 0o600 });
    if (await readFile('tasks.json', 'utf8') !== before) throw Error('Concurrent task queue edit; retry');
    // A live runner may claim a task during preparation; preserve that attempt.
    const current = JSON.parse(await readFile('state.json', 'utf8'));
    for (const row of result.report) {
      if (['follow_up', 'enabled'].includes(row.action) && current[row.issue]?.status !== state[row.issue]?.status) throw Error('Worker state changed; refresh snapshots and retry');
    }
    await rename(tmp, 'tasks.json');
  } finally { await unlink(tmp).catch(() => {}); }
}
console.log(JSON.stringify({ written: args.includes('--write'), report: result.report }, null, 2));
