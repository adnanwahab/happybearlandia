// Explicit coordinator approval creates a fresh attempt without deleting history.
export function approveRemaining(issues: any[], prs: any[], tasks: any[], state: Record<string, any>) {
  const next = tasks.map(t => ({ ...t }));
  const ids = new Set(issues.map(i => i.id));
  const report: { issue: string; task: string; action: string }[] = [];
  const issueId = (t: any) => t.issueId ?? t.id.replace(/-r[1-9]\d*$/, '');
  for (const task of next) if (!ids.has(issueId(task))) task.enabled = false;
  for (const issue of issues) {
    const family = next.filter(t => issueId(t) === issue.id);
    for (const task of family) {
      task.linearStatus = issue.status; task.linearStatusType = issue.statusType;
    }
    const active = family.find(t => ['running', 'publishing'].includes(state[t.id]?.status));
    const open = prs.find(p => p.state === 'OPEN' && (p.headRefName === `mini/${issue.id}` || new RegExp(`^mini/${issue.id}-r[1-9]\\d*$`).test(p.headRefName)));
    if (active || open) {
      report.push({ issue: issue.id, task: active?.id ?? open.headRefName.slice(5), action: active ? 'active' : 'open_pr' });
      continue;
    }
    const pending = family.find(t => t.approvalBatch === 'remaining-20261112' && !state[t.id]);
    if (pending) { pending.enabled = true; report.push({ issue: issue.id, task: pending.id, action: 'already_queued' }); continue; }
    const unattempted = family.find(t => !state[t.id]);
    let task = unattempted;
    if (!task) {
      let revision = 2;
      while (next.some(t => t.id === `${issue.id}-r${revision}`) || state[`${issue.id}-r${revision}`] || prs.some(p => p.headRefName === `mini/${issue.id}-r${revision}`)) revision++;
      task = { id: `${issue.id}-r${revision}` }; next.push(task);
    }
    for (const old of family) old.enabled = false;
    Object.assign(task, {
      issueId: issue.id, approvalBatch: 'remaining-20261112', enabled: true, retry: false,
      linearStatus: issue.status, linearStatusType: issue.statusType, url: issue.url,
      prompt: `Linear issue ${issue.id}: ${issue.title}\nStatus: ${issue.status} (${issue.statusType})\nURL: ${issue.url}\n\n${issue.description}\n\nThis is a fresh approved follow-up for ${issue.id}; prior task results are history, not proof of acceptance. Audit current remote-base code, existing reports and PRs first. Complete missing acceptance criteria with real verification. Preserve useful prior work. Do not duplicate existing functionality or invent measurements. If already satisfied, save a concise acceptance report with source/test evidence. Save analysis-only deliverables as docs/reviews/${task.id}.md so they can be reviewed in a PR. Follow AGENTS.md. No merge, deployment or production data changes.`,
    });
    report.push({ issue: issue.id, task: task.id, action: unattempted ? 'enabled' : 'follow_up' });
  }
  return { tasks: next, report };
}
