type Task = { id: string; enabled?: boolean; retry?: boolean; linearStatusType?: string };
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
