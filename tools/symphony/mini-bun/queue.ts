type Task = { id: string; enabled?: boolean; retry?: boolean; linearStatusType?: string; disabledReason?: string | null; holdReason?: string | null };
type State = Record<string, { status: string }>;
export function runnable(task: Task, state: State, claimed: Set<string>) {
  return task.enabled === true && !['completed', 'canceled', 'duplicate'].includes(task.linearStatusType ?? '') && !claimed.has(task.id) &&
    (!state[task.id] || (task.retry === true && ['failed', 'interrupted', 'no_changes'].includes(state[task.id].status)));
}
export function queueSummary(tasks: Task[], state: State, claimed = new Set<string>()) {
  return {
    runnable: tasks.filter(t => runnable(t, state, claimed)).length,
    disabled: tasks.filter(t => t.enabled !== true).length,
    terminal: tasks.filter(t => t.enabled === true && ['completed', 'canceled', 'duplicate'].includes(t.linearStatusType ?? '')).length,
    priorAttempts: tasks.filter(t => t.enabled === true && !['completed', 'canceled', 'duplicate'].includes(t.linearStatusType ?? '') && !runnable(t, state, claimed)).length,
    running: Object.values(state).filter(e => e.status === 'running').length,
  };
}

export function waitingExplanation(tasks: Task[]) {
  const current=tasks.filter(t=>t.enabled!==true && !['superseded','terminal','source_removed'].includes(t.disabledReason??'') && !['completed','canceled','duplicate'].includes(t.linearStatusType??'') && t.holdReason);
  const reasons=[...new Set(current.map(t=>t.holdReason!))];
  if(reasons.length)return `Held: ${reasons.slice(0,3).join(' ')}${reasons.length>3?' Additional holds are recorded in tasks.json.':''}`;
  return 'No new eligible work. Prior PRs/results require review; explicit operator-disabled tasks remain disabled.';
}
