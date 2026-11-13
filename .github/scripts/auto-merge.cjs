'use strict';

// Run only from the trusted default-branch workflow. Never check out PR code here.
const OWNER = 'adnanwahab';
const REPO = 'happybearlandia';
const FULL_NAME = `${OWNER}/${REPO}`;
const BASES = new Set(['main', 'sprint/one-city-two-futures-20261111']);
const CORE = { file: 'core-journeys.yml', job: 'verify' };
const SUCCESSFUL_CHECKS = new Set(['success', 'neutral', 'skipped']);
const MAINTAINERS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const params = extra => ({ owner: OWNER, repo: REPO, per_page: 100, ...extra });
const newest = items => [...items].sort((a, b) =>
  Date.parse(b.created_at || b.submitted_at || b.started_at || 0) -
  Date.parse(a.created_at || a.submitted_at || a.started_at || 0) || b.id - a.id);
const all = (github, method, extra) => github.paginate(method, params(extra));

function hasHoldMarker(text) {
  return /\b(?:do[\s_-]+not[\s_-]+merge|don['’]t[\s_-]+merge|no[\s_-]+auto[\s_-]*merge|no[\s_-]+merge|hold|blocked|wip|manual[\s_-]+merge)\b/i.test(String(text || ''));
}

function requiredWorkflows(paths) {
  const result = [CORE];
  if (paths.some(path => path.startsWith('ops/symphony/') || path === '.github/workflows/codex-orchestration.yml')) {
    result.push({ file: 'codex-orchestration.yml', job: 'pipeline' });
  }
  if (paths.some(path => path.startsWith('tools/symphony/local/') || path === '.github/workflows/symphony-throughput.yml')) {
    result.push({ file: 'symphony-throughput.yml', job: 'coordinator' });
  }
  return result;
}

function latestPer(items, key) {
  const seen = new Set();
  return newest(items).filter(item => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function checkFailures(checkRuns, statuses) {
  const failures = [];
  for (const check of latestPer(checkRuns, item => `${item.app?.id || item.app?.slug || 'unknown'}:${item.check_suite?.id ?? item.id ?? 'unknown-suite'}:${item.name}`)) {
    if (check.status !== 'completed' || !SUCCESSFUL_CHECKS.has(check.conclusion)) {
      failures.push(`check ${check.name || '(unnamed)'} is ${check.conclusion || check.status || 'unknown'}`);
    }
  }
  for (const status of latestPer(statuses, item => item.context)) {
    if (status.state !== 'success') failures.push(`status ${status.context || '(unnamed)'} is ${status.state || 'unknown'}`);
  }
  return failures;
}

async function workflowEvidence(github, workflow, sha, { number, main = false } = {}) {
  const runs = await all(github, github.rest.actions.listWorkflowRuns, {
    workflow_id: workflow.file, head_sha: sha,
    ...(main ? {} : { event: 'pull_request' }),
  });
  const matching = newest(runs.filter(run => run.head_sha === sha &&
    String(run.path || '').split('@')[0] === `.github/workflows/${workflow.file}` &&
    (main ? ['push', 'workflow_dispatch'].includes(run.event) && run.head_branch === 'main' : run.event === 'pull_request')));
  const run = matching[0];
  if (!run) return { ok: false, missing: true, reason: `${workflow.file} has no matching run for ${sha.slice(0, 12)}` };
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    return { ok: false, reason: `${workflow.file} latest run is ${run.conclusion || run.status || 'unknown'}` };
  }
  if (!main && !run.pull_requests?.some(pr => pr.number === number && pr.head?.sha === sha)) {
    return { ok: false, reason: `${workflow.file} run is not bound to this PR and head` };
  }
  const jobs = await all(github, github.rest.actions.listJobsForWorkflowRun, { run_id: run.id, filter: 'latest' });
  const required = jobs.filter(job => job.name === workflow.job);
  if (!required.length || required.some(job => job.status !== 'completed' || job.conclusion !== 'success' || job.head_sha !== sha)) {
    return { ok: false, reason: `${workflow.file} requires a successful ${workflow.job} job on the exact head` };
  }
  return { ok: true, runId: run.id };
}

async function mainHealth(github) {
  const { data: branch } = await github.rest.repos.getBranch(params({ branch: 'main' }));
  const sha = branch.commit?.sha;
  if (!sha) throw new Error('Cannot resolve current main SHA');
  return { sha, ...(await workflowEvidence(github, CORE, sha, { main: true })) };
}

async function reviewState(github, number) {
  let cursor = null;
  let blockedDecision = null;
  let unresolved = false;
  do {
    const data = await github.graphql(`query($owner:String!,$repo:String!,$number:Int!,$cursor:String) {
      repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
        reviewDecision
        reviewThreads(first:100,after:$cursor) { nodes { isResolved } pageInfo { hasNextPage endCursor } }
      } }
    }`, { owner: OWNER, repo: REPO, number, cursor });
    const pr = data.repository?.pullRequest;
    if (!pr || !pr.reviewThreads?.pageInfo || !Array.isArray(pr.reviewThreads.nodes)) throw new Error('Incomplete review-thread response');
    if (pr.reviewDecision && pr.reviewDecision !== 'APPROVED') blockedDecision = pr.reviewDecision;
    unresolved ||= pr.reviewThreads.nodes.some(thread => thread.isResolved !== true);
    const page = pr.reviewThreads.pageInfo;
    if (page.hasNextPage && (!page.endCursor || page.endCursor === cursor)) throw new Error('Invalid review-thread pagination');
    cursor = page.hasNextPage ? page.endCursor : null;
  } while (cursor);
  return { blockedDecision, unresolved };
}

async function assessPullRequest({ github, number }) {
  const { data: pr } = await github.rest.pulls.get(params({ pull_number: number }));
  const headSha = pr.head?.sha;
  const baseRef = pr.base?.ref;
  const result = { number, headSha, baseRef, mergeSha: pr.merge_commit_sha, eligible: false };
  const skip = reason => ({ ...result, reason });
  if (pr.state !== 'open' || pr.merged) return skip('PR is not open');
  if (pr.draft) return skip('draft PR');
  if (pr.head?.repo?.full_name?.toLowerCase() !== FULL_NAME) return skip('fork or missing head repository');
  if (!BASES.has(baseRef)) return skip(`base ${baseRef || '(missing)'} is outside the merge scope`);
  if (!headSha) return skip('missing head SHA');
  if (hasHoldMarker(pr.title) || pr.labels?.some(label => hasHoldMarker(label.name))) return skip('hold marker in title or labels');
  if (pr.requested_reviewers?.length || pr.requested_teams?.length) return skip('a requested person or team review is still pending');
  if (pr.mergeable !== true || pr.mergeable_state !== 'clean') return skip(`GitHub mergeability is ${pr.mergeable_state || 'unknown'}`);

  const files = await all(github, github.rest.pulls.listFiles, { pull_number: number });
  if (!files.length) return skip('no changed files');
  // listFiles has a 3,000-file API ceiling; never silently assess an incomplete set.
  if (typeof pr.changed_files !== 'number' || files.length !== pr.changed_files) return skip('changed-file inventory is incomplete');
  const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
  if (paths.some(path => path.startsWith('.github/') || /(^|\/)AGENTS\.md$/.test(path))) return skip('workflow or agent-instruction changes require manual review');

  const comments = await all(github, github.rest.issues.listComments, { issue_number: number });
  if (comments.some(comment => (MAINTAINERS.has(comment.author_association) || comment.user?.login?.toLowerCase() === OWNER) && hasHoldMarker(comment.body))) {
    return skip('maintainer comment requests a hold');
  }
  const reviews = await all(github, github.rest.pulls.listReviews, { pull_number: number });
  const decisive = reviews.filter(review => ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state));
  if (latestPer(decisive, review => review.user?.id || review.user?.login || `unknown-${review.id}`).some(review => review.state === 'CHANGES_REQUESTED')) {
    return skip('a current review requests changes');
  }
  const review = await reviewState(github, number);
  if (review.blockedDecision) return skip(`GitHub review decision is ${review.blockedDecision}`);
  if (review.unresolved) return skip('unresolved review threads');

  const { data: base } = await github.rest.repos.getBranch(params({ branch: baseRef }));
  result.baseSha = base.commit?.sha;
  if (!result.baseSha) throw new Error(`Cannot resolve ${baseRef}`);
  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead(params({ basehead: `${result.baseSha}...${headSha}` }));
  // Source-head Actions metadata is not proof of a synthetic checkout SHA.
  // Conservatively require the current target commit to already be in the head.
  if (!['ahead', 'identical'].includes(comparison.status)) return skip('current base is not an ancestor of head; update the branch and rerun CI');

  for (const workflow of requiredWorkflows(paths)) {
    const evidence = await workflowEvidence(github, workflow, headSha, { number });
    if (!evidence.ok) return skip(evidence.reason);
  }
  for (const ref of new Set([headSha, pr.merge_commit_sha].filter(Boolean))) {
    const checks = await all(github, github.rest.checks.listForRef, { ref, filter: 'latest' });
    const statuses = await all(github, github.rest.repos.listCommitStatusesForRef, { ref });
    const failures = checkFailures(checks, statuses);
    if (failures.length) return skip(`${ref.slice(0, 12)}: ${failures.join('; ')}`);
  }
  if (baseRef === 'main') {
    const health = await mainHealth(github);
    if (health.sha !== result.baseSha) return skip('main advanced during assessment');
    if (!health.ok) return skip(`current main is not verified: ${health.reason}`);
  }
  return { ...result, eligible: true, reason: 'exact-head CI, reviews, and current-base ancestry verified' };
}

async function run({ github, context, core, dryRun = false }) {
  const rows = [];
  let merged = 0;
  const report = (pr, status, detail) => {
    rows.push({ pr, status, detail });
    core.info(`${pr}: ${status} — ${detail}`);
  };
  try {
    if (`${context.repo?.owner}/${context.repo?.repo}`.toLowerCase() !== FULL_NAME) throw new Error('This merger is restricted to adnanwahab/happybearlandia');
    const { data: repository } = await github.rest.repos.get(params());
    const mergeMethod = repository.allow_merge_commit ? 'merge' : repository.allow_squash_merge ? 'squash' : null;
    if (!mergeMethod) throw new Error('Neither merge commits nor squash merging is enabled');

    const health = await mainHealth(github);
    if (health.missing && !dryRun) {
      // Only missing evidence is bootstrapped. A failing/pending run is never rerun here.
      await github.rest.actions.createWorkflowDispatch(params({ workflow_id: CORE.file, ref: 'main' }));
      report('main', 'CI requested', `No current push/manual core run exists for ${health.sha.slice(0, 12)}`);
    } else if (!health.ok) {
      report('main', 'held', `${health.reason}${dryRun && health.missing ? '; dry run does not dispatch CI' : ''}`);
    }

    const prs = await all(github, github.rest.pulls.list, { state: 'open', sort: 'created', direction: 'asc' });
    prs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.number - b.number);
    for (const listed of prs) {
      const first = await assessPullRequest({ github, number: listed.number });
      if (!first.eligible) { report(`#${listed.number}`, 'skipped', first.reason); continue; }
      if (dryRun) { report(`#${listed.number}`, 'eligible (dry run)', first.reason); continue; }

      // Repeat all gates immediately before the mutation; never reuse a stale pass.
      const fresh = await assessPullRequest({ github, number: listed.number });
      if (!fresh.eligible) { report(`#${listed.number}`, 'skipped on recheck', fresh.reason); continue; }
      if (fresh.headSha !== first.headSha || fresh.baseSha !== first.baseSha) {
        report(`#${listed.number}`, 'skipped on recheck', 'head or base changed during the pass'); continue;
      }
      const [{ data: finalPR }, { data: finalBase }] = await Promise.all([
        github.rest.pulls.get(params({ pull_number: listed.number })),
        github.rest.repos.getBranch(params({ branch: fresh.baseRef })),
      ]);
      if (finalPR.head?.sha !== fresh.headSha || finalPR.base?.ref !== fresh.baseRef || finalBase.commit?.sha !== fresh.baseSha ||
          finalPR.state !== 'open' || finalPR.draft || finalPR.mergeable !== true || finalPR.mergeable_state !== 'clean' ||
          finalPR.requested_reviewers?.length || finalPR.requested_teams?.length ||
          hasHoldMarker(finalPR.title) || finalPR.labels?.some(label => hasHoldMarker(label.name))) {
        report(`#${listed.number}`, 'skipped on final read', 'PR state, head, or target changed'); continue;
      }
      const { data: merge } = await github.rest.pulls.merge(params({ pull_number: listed.number, sha: fresh.headSha, merge_method: mergeMethod }));
      if (!merge.merged) { report(`#${listed.number}`, 'not merged', merge.message || 'GitHub refused the merge'); continue; }
      merged = 1;
      report(`#${listed.number}`, 'merged', `${mergeMethod}; verified head ${fresh.headSha}; merge ${merge.sha}`);
      if (fresh.baseRef === 'main') {
        // GITHUB_TOKEN merges do not emit a push-triggered CI run. Refresh the baseline explicitly.
        await github.rest.actions.createWorkflowDispatch(params({ workflow_id: CORE.file, ref: 'main' }));
        report('main', 'CI requested', `Post-merge core verification requested after PR #${listed.number}`);
      }
      break; // One merge per pass; every later candidate gets a fresh next-pass base.
    }
    if (!prs.length) report('repository', 'idle', 'No open pull requests');
  } catch (error) {
    report('run', 'error', error.message || String(error));
    core.setFailed(`Auto-merge stopped: ${error.message || error}`);
  } finally {
    await core.summary.addHeading('HappyBearLandia auto-merge')
      .addRaw(`${dryRun ? 'Read-only dry run' : 'Scheduled/manual merge pass'}. Merged ${merged} PR(s); maximum one per pass.\n\n`)
      .addTable([
        [{ data: 'PR / target', header: true }, { data: 'Result', header: true }, { data: 'Evidence / reason', header: true }],
        ...rows.map(row => [row.pr, row.status, row.detail]),
      ]).write();
  }
  return { merged, rows };
}

module.exports = { run, assessPullRequest, requiredWorkflows, hasHoldMarker, checkFailures };
