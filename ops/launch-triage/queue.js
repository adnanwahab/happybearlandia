// Local operator preparation only. This module has no network or issue-write path.
import { createHash } from 'node:crypto';
const families = ['HBL-FUN', 'HBL-W1', 'HBL-SYM'];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const words = text => new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const normalize = text => String(text).trim().replace(/\s+/g, ' ').toLowerCase();
const check = value => { if (!value) throw new Error('Invalid triage input'); };

export function buildQueue({ counts = [], suggestions = [], votes = [], backlog }) {
  check(backlog?.version === 1 && typeof backlog.revision === 'string' && backlog.revision.length > 0);
  check(Array.isArray(backlog.issues) && Array.isArray(backlog.completeFamilies));
  check([counts, suggestions, votes].every(rows => Array.isArray(rows) && rows.length <= 10000));
  const issues = backlog.issues.map(issue => {
    check(/^SHE-\d+$/.test(issue.id) && typeof issue.title === 'string');
    check(families.some(family => issue.title.includes('[' + family + '-')));
    return { id: issue.id, title: issue.title };
  }).sort((a, b) => a.id.localeCompare(b.id));
  check(new Set(issues.map(i => i.id)).size === issues.length);
  const groups = new Map();
  const seen = new Map();
  function add(key, source, search, category) {
    const identity = source.type + ':' + source.id;
    const fingerprint = hash(source);
    check(!seen.has(identity) || seen.get(identity) === fingerprint);
    if (seen.has(identity)) return;
    seen.set(identity, fingerprint);
    const group = groups.get(key) || { key, category, search, sources: [] };
    group.sources.push(source);
    groups.set(key, group);
  }
  for (const row of counts) {
    check(['confusing', 'favorite'].includes(row.kind) && ['exploring', 'choosing', 'comparing', 'inspecting', 'sharing'].includes(row.moment));
    check(Number.isSafeInteger(row.count) && row.count > 0);
    add('count:' + row.kind + ':' + row.moment, {
      type: 'player-count', id: row.kind + ':' + row.moment, count: row.count,
      consent: 'v1 collector requires literal consent:true; individual receipts unavailable'
    }, 'feedback ' + row.moment, row.kind);
  }
  for (const row of suggestions) {
    check(typeof row.id === 'string' && typeof row.title === 'string' && typeof row.details === 'string');
    check(['idea', 'problem', 'confusing', 'favorite'].includes(row.kind));
    // Preserve the original evidence locally. Never infer publication consent.
    // Legacy rows lack consent receipts; reviewers must resolve that uncertainty.
    const source = { type: 'patch-suggestion', id: row.id, kind: row.kind,
      title: row.title, details: row.details, createdAt: row.created_at,
      status: row.status, mergedInto: row.merged_into ?? null,
      replaySeed: row.replay_seed ?? null, worldContext: row.world_context ?? null,
      consent: 'current endpoint requires opt-in; per-row/legacy receipt unavailable; private review only' };
    add('suggestion:' + hash([row.kind, normalize(row.title), normalize(row.details), source.replaySeed, source.worldContext]), source,
      row.title + ' ' + row.details, row.kind);
  }
  for (const row of votes) {
    check(typeof row.id === 'string' && typeof row.title === 'string');
    check([row.votes, row.upvotes, row.score].every(Number.isSafeInteger));
    add('ballot:' + row.id, { type: 'patch-ballot', id: row.id, votes: row.votes,
      upvotes: row.upvotes, score: row.score, closesAt: row.closesAt,
      github: row.github ?? null, consent: 'consent-gated advisory votes; no publication consent' }, row.title, 'ballot');
  }
  const entries = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(group => {
    group.sources.sort((a, b) => a.id.localeCompare(b.id));
    const terms = words(group.search);
    const matches = issues.map(issue => ({ ...issue, score: [...words(issue.title)].filter(w => terms.has(w)).length }))
      .filter(issue => issue.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return { key: group.key, category: group.category, sources: group.sources, matches,
      status: 'needs-human-review', evidence: 'Submission reports and advisory votes; no verified defect, unique-player count or simulation result.' };
  });
  const search = { revision: backlog.revision, complete: families.every(f => backlog.completeFamilies.includes(f)),
    families, issues, method: 'local title token overlap; human semantic duplicate review required' };
  return { version: 1, revision: hash({ search, entries }), private: true, search, entries };
}

// A review only produces a safe preview, never opens a ticket. No free text from
// submissions, backlog titles, IDs, seeds or PR heads is copied into public copy.
export function reviewDraft(queue, review) {
  check(queue?.version === 1 && queue.private === true && queue.revision === hash({ search: queue.search, entries: queue.entries }));
  check(review?.queueRevision === queue.revision && review.reviewed === true && review.duplicateSearchReviewed === true);
  check(queue.search.complete);
  const entry = queue.entries.find(item => item.key === review.key);
  check(entry && ['idea', 'problem', 'confusing', 'favorite', 'ballot'].includes(entry.category));
  if (review.action === 'link-existing') {
    check(queue.search.issues.some(issue => issue.id === review.issueId));
    return { action: 'link-existing', issueId: review.issueId, queueRevision: queue.revision, key: entry.key, private: true };
  }
  check(review.action === 'preview-new' && review.noExistingIssue === true);
  return { action: 'preview-new', requiresManualCreation: true,
    title: 'Review launch ' + entry.category + ' feedback',
    description: 'Human-reviewed launch feedback warrants investigation. Submission reports are not verified defects or model results. Reproduction and public evidence are unavailable until independently reviewed. No private input is included.' };
}
