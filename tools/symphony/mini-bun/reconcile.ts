import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
export type Issue = { id: string; title: string; description: string; status: string; statusType?: string; url: string };
export function reconcile(issues: Issue[], prs: any[], tasks: any[], state: Record<string, any>) {
  const next = tasks.map(t => ({ ...t }));
  const report: any[] = [];
  for (const issue of issues) {
    if (!/^SHE-\d+$/.test(issue.id) || !issue.description || issue.description.includes('(truncated, use `get_issue`')) throw Error(`Incomplete issue ${issue.id}`);
    const matches = prs.filter(p => p.headRefName === `mini/${issue.id}`);
    const delivery = matches.find(p => p.state === 'MERGED') ?? matches.find(p => p.state === 'OPEN');
    const prior = next.find(t => t.id === issue.id);
    const statusType = issue.statusType ?? ({ Backlog: 'backlog', 'In Review': 'started', Done: 'completed', Canceled: 'canceled' } as any)[issue.status];
    const reason = delivery ? (delivery.state === 'MERGED' ? 'merged_acceptance_review' : 'existing_pr') :
      issue.status === 'In Review' ? 'review_required' :
      /Run in:\*?\*? Claude|five-person|no-instructions first-play|observed player behavior|staged launch-load|Agent Training Gym/i.test(issue.title + '\n' + issue.description) ? 'external_prerequisite' :
      ['completed', 'canceled'].includes(statusType) ? 'terminal' :
      state[issue.id]?.status === 'no_changes' ? 'no_changes_review_required' :
      state[issue.id] ? 'prior_attempt_review_required' : 'ready_for_triage';
    const task = {
      ...prior, id: issue.id, url: issue.url, linearStatus: issue.status, linearStatusType: statusType,
      prompt: `Linear issue ${issue.id}: ${issue.title}\nStatus: ${issue.status} (${statusType})\nURL: ${issue.url}\n\n${issue.description}\n\nAudit existing code and merged work first. Follow AGENTS.md. Complete the acceptance criteria and relevant tests. If external evidence or human participation is required, record the blocker; never fabricate results.`,
      enabled: false, retry: false,
    };
    if (prior) Object.assign(prior, task); else next.push(task);
    report.push({ id: issue.id, title: issue.title, reason, localStatus: state[issue.id]?.status ?? null, pullRequestUrl: delivery?.url ?? null });
  }
  return { tasks: next, report };
}
if (import.meta.main) {
  const args = process.argv.slice(2);
  const snapshotPath = args.find(a => !a.startsWith('--'));
  if (!snapshotPath) throw Error('Usage: bun reconcile.ts snapshot.json [--write] (snapshot: {issues, pullRequests})');
  const root = process.cwd();
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  if (snapshot.complete !== true || !Array.isArray(snapshot.issues) || !Array.isArray(snapshot.pullRequests)) throw Error('Require a complete, timestamped snapshot with issues and pullRequests');
  if (!snapshot.observedAt || Date.now() - Date.parse(snapshot.observedAt) > 3600000 || !Number.isFinite(Date.parse(snapshot.observedAt))) throw Error('Snapshot must be less than one hour old');
  const tasks = JSON.parse(await readFile(path.join(root, 'tasks.json'), 'utf8'));
  const state = JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8'));
  const result = reconcile(snapshot.issues, snapshot.pullRequests, tasks, state);
  if (args.includes('--write')) {
    // Require the operator to stop the runner before replacing its input queue.
    if (await Bun.file(path.join(root, '.runner.lock', 'pid')).exists()) throw Error('Stop Mini Symphony before updating its task queue');
    const tmp = path.join(root, `tasks.json.${crypto.randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(result.tasks, null, 2) + '\n', { mode: 0o600 });
    await rename(tmp, path.join(root, 'tasks.json'));
  }
  console.log(JSON.stringify({ observedAt: snapshot.observedAt, written: args.includes('--write'), report: result.report }, null, 2));
}
