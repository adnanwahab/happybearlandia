import { approvedPatchCandidates } from './candidates.js';

// Only maintainers can add approved candidates to this checked-in module.
// Votes change scheduling priority, never executable prompt content or scope.
export function buildReadyQueue(ballot, options = {}) {
  const verified = new Set(options.verifiedTaskIds || []);
  const active = new Set(options.activeTaskIds || []);
  const minUpvotes = Number.isInteger(options.minUpvotes) ? Math.max(1, options.minUpvotes) : 5;
  const minScore = Number.isInteger(options.minScore) ? Math.max(1, options.minScore) : 3;
  const now = options.now ?? Date.now();
  const byId = new Map((ballot || []).map(row => [row.id, row]));
  const tasks = [];
  const skipped = [];
  for (const entry of approvedPatchCandidates) {
    const poll = byId.get(entry.id);
    let reason = null;
    if (!poll) reason = 'not in active ballot';
    else if (poll.open || Date.parse(poll.closesAt) > now) reason = 'voting remains open';
    else if (!Number.isFinite(poll.score) || !Number.isFinite(poll.upvotes) ||
      poll.score < minScore || poll.upvotes < minUpvotes) reason = 'vote threshold not met';
    else if (active.has(entry.id)) reason = 'already assigned';
    else if (verified.has(entry.id)) reason = 'already verified';
    else if (entry.dependencies.some(id => !verified.has(id))) reason = 'unverified dependency: ' + entry.dependencies.filter(id => !verified.has(id)).join(', ');
    if (reason) {
      skipped.push({ taskId: entry.id, reason });
      continue;
    }
    tasks.push({
      taskId: entry.id, status: 'READY', source: 'maintainer-curated-vote', area: entry.area,
      title: entry.title, description: entry.summary, acceptance: entry.acceptance,
      dependencies: [...entry.dependencies], ownedPaths: [...entry.ownedPaths],
      verification: [...entry.verification], voteScore: poll.score, upvotes: poll.upvotes
    });
  }
  tasks.sort((a, b) => b.voteScore - a.voteScore || a.taskId.localeCompare(b.taskId));
  return { tasks, skipped };
}
