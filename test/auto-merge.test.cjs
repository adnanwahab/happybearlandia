'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../.github/scripts/auto-merge.cjs');

const OWNER = 'adnanwahab';
const REPO = 'happybearlandia';
const FULL_NAME = `${OWNER}/${REPO}`;
const SPRINT = 'sprint/one-city-two-futures-20261111';
const MAIN = 'a'.repeat(40);
const SPRINT_SHA = 'd'.repeat(40);
const MERGED = 'f'.repeat(40);
const head = n => n.toString(16).padStart(40, '0');
const time = secondsAgo => new Date(Date.now() - secondsAgo * 1000).toISOString();
const repoInfo = () => ({ name: REPO, full_name: FULL_NAME, owner: { login: OWNER } });

function pull(number = 1, overrides = {}) {
  return {
    number, title: `Implement task ${number}`, body: 'A small independently reviewable change.',
    state: 'open', draft: false, mergeable: true, mergeable_state: 'clean', changed_files: 1,
    labels: [], requested_reviewers: [], requested_teams: [],
    created_at: time(86400 - number), updated_at: time(600),
    html_url: `https://github.com/${FULL_NAME}/pull/${number}`,
    head: { sha: head(number), ref: `mini/TASK-${number}`, repo: repoInfo() },
    base: { sha: MAIN, ref: 'main', repo: repoInfo() },
    merge_commit_sha: head(number + 10000), ...overrides,
  };
}

function workflow(id, sha, branch, file = 'core-journeys.yml', overrides = {}) {
  const number = Number(branch.match(/TASK-(\d+)/)?.[1]);
  return {
    id, name: file, path: `.github/workflows/${file}`, head_sha: sha, head_branch: branch,
    status: 'completed', conclusion: 'success', event: 'pull_request',
    created_at: time(120), updated_at: time(60), run_started_at: time(120),
    run_attempt: 1, run_number: id, repository: repoInfo(), head_repository: repoInfo(),
    pull_requests: number ? [{ number, head: { sha }, base: { sha: MAIN } }] : [], ...overrides,
  };
}

function fixture(options = {}) {
  const prs = structuredClone(options.prs ?? [pull()]);
  for (const pr of prs) if (options.files?.[pr.number]) pr.changed_files = options.files[pr.number].length;
  const calls = [], writes = [], messages = [], outputs = {};
  const counters = new Map();
  const runs = options.runs ?? [
    workflow(100, MAIN, 'main', 'core-journeys.yml', { event: 'push' }),
    ...prs.map(pr => workflow(100 + pr.number, pr.head.sha, pr.head.ref, 'core-journeys.yml', {
      pull_requests: [{ number: pr.number, head: { sha: pr.head.sha }, base: { sha: pr.base.sha } }],
    })),
  ];
  const defaultJobs = runId => [{
    id: runId * 10, name: 'verify', status: 'completed', conclusion: 'success',
    head_sha: runs.find(run => run.id === runId)?.head_sha,
    started_at: time(115), completed_at: time(60),
    steps: [{ name: 'Run checks', status: 'completed', conclusion: 'success' }],
  }];
  let mainSha = MAIN;
  let dispatchFailures = options.dispatchFailures ?? 0;
  const response = data => ({ data, status: 200, headers: {} });
  function page(items, args, key) {
    const size = options.pageSize ?? 100;
    const offset = ((args.page ?? 1) - 1) * size;
    const chunk = items.slice(offset, offset + size);
    const result = response(key ? { [key]: chunk, total_count: items.length } : chunk);
    if (offset + size < items.length) result.headers.link = '<https://api.github.invalid/next>; rel="next"';
    return result;
  }
  function sequence(key, values, fallback) {
    const i = counters.get(key) ?? 0; counters.set(key, i + 1);
    return values ? values[Math.min(i, values.length - 1)] : fallback;
  }
  const handlers = {
    'repos.get': () => response({ ...repoInfo(), default_branch: 'main', allow_squash_merge: true,
      allow_merge_commit: true, allow_rebase_merge: true, ...options.repository }),
    'repos.getBranch': args => response({ name: args.branch, protected: true, commit: {
      sha: sequence(`branch:${args.branch}`, options.branchSequence?.[args.branch], args.branch === 'main' ? mainSha : SPRINT_SHA),
    } }),
    'repos.compareCommitsWithBasehead': args => response(typeof options.compare === 'function'
      ? options.compare(args) : { status: options.compare ?? 'ahead', ahead_by: 1, behind_by: 0,
        merge_base_commit: { sha: args.basehead.split('...')[0] } }),
    'repos.getCommit': args => response(options.commits?.[args.ref] ?? {
      sha: args.ref, parents: [{ sha: MAIN }, { sha: head(1) }],
    }),
    'repos.listCommitStatusesForRef': args => page(options.statuses?.[args.ref] ?? [], args),
    'repos.getCombinedStatusForRef': args => response({ state: 'success', statuses: options.statuses?.[args.ref] ?? [] }),
    'pulls.list': args => page(prs.filter(pr => (!args.base || pr.base.ref === args.base) &&
      (!args.state || args.state === 'all' || pr.state === args.state)), args),
    'pulls.get': args => response(structuredClone(sequence(`pr:${args.pull_number}`,
      options.prSequence?.[args.pull_number], prs.find(pr => pr.number === args.pull_number)))),
    'pulls.listFiles': args => page(options.files?.[args.pull_number] ?? [{ filename: 'src/world.ts', status: 'modified' }], args),
    'pulls.listReviews': args => page(options.reviews?.[args.pull_number] ?? [], args),
    'issues.listComments': args => page(options.comments?.[args.issue_number] ?? [], args),
    'actions.listWorkflowRuns': args => page(runs.filter(run =>
      (!args.workflow_id || run.path.endsWith(`/${args.workflow_id}`)) &&
      (!args.head_sha || run.head_sha === args.head_sha) &&
      (!args.branch || run.head_branch === args.branch) &&
      (!args.event || run.event === args.event) &&
      (!args.status || run.status === args.status || run.conclusion === args.status)), args, 'workflow_runs'),
    'actions.getWorkflowRun': args => response(runs.find(run => run.id === args.run_id)),
    'actions.listJobsForWorkflowRun': args => page(options.jobs?.[args.run_id] ?? defaultJobs(args.run_id), args, 'jobs'),
    'checks.listForRef': args => page(options.checks?.[args.ref] ?? [], args, 'check_runs'),
    'pulls.merge': args => {
      writes.push({ method: 'pulls.merge', args });
      if (options.mergeError) throw options.mergeError;
      const pr = prs.find(pr => pr.number === args.pull_number);
      if (pr.base.ref === 'main') mainSha = MERGED;
      pr.state = 'closed'; pr.merged = true;
      return response({ merged: true, sha: MERGED, message: 'Merged test fixture' });
    },
    'actions.createWorkflowDispatch': args => {
      writes.push({ method: 'actions.createWorkflowDispatch', args });
      if (dispatchFailures-- > 0) throw new Error('Simulated transient workflow dispatch failure');
      if (options.recordPendingDispatch) runs.push(workflow(1000 + writes.length, mainSha, 'main', 'core-journeys.yml', {
        event: 'workflow_dispatch', status: 'queued', conclusion: null,
      }));
      return response({});
    },
    ...options.handlers,
  };
  const rest = {};
  for (const [name, handler] of Object.entries(handlers)) {
    const [group, method] = name.split('.');
    rest[group] ??= {};
    rest[group][method] = async args => { calls.push({ method: name, args }); return handler(args); };
    rest[group][method].route = name;
  }
  const github = {
    rest,
    paginate: async (method, args) => {
      assert.equal(typeof method, 'function', 'pagination must call a declared mocked endpoint');
      const results = [];
      for (let i = 1; i <= 20; i++) {
        const result = await method({ ...args, page: i });
        const items = Array.isArray(result.data) ? result.data :
          result.data.workflow_runs ?? result.data.jobs ?? result.data.check_runs;
        assert.ok(Array.isArray(items), `Unexpected pagination shape for ${method.route}`);
        results.push(...items);
        if (!result.headers?.link?.includes('rel="next"')) return results;
      }
      throw new Error('Mock pagination exceeded its finite page limit');
    },
    graphql: async (query, args) => {
      calls.push({ method: 'graphql', args });
      const number = args.number ?? args.pullNumber ?? args.pullRequestNumber;
      assert.ok(number, 'GraphQL request includes a PR number');
      const all = options.threads?.[number] ?? [];
      const offset = args.cursor ? Number(args.cursor) : 0;
      const size = options.pageSize ?? 100;
      return { repository: { pullRequest: {
        reviewDecision: options.reviewDecision?.[number] ?? null,
        reviewThreads: { nodes: all.slice(offset, offset + size), pageInfo: {
          hasNextPage: offset + size < all.length,
          endCursor: offset + size < all.length ? String(offset + size) : null,
        } },
      } } };
    },
  };
  const core = Object.fromEntries(['info', 'warning', 'notice', 'error', 'debug', 'setFailed'].map(name =>
    [name, value => messages.push({ level: name, value })]));
  core.setOutput = (name, value) => { outputs[name] = value; };
  core.summary = { addHeading() { return this; }, addRaw() { return this; }, addTable() { return this; }, async write() {} };
  const context = { repo: { owner: OWNER, repo: REPO }, runId: 9999,
    payload: { repository: { ...repoInfo(), default_branch: 'main' } } };
  return { github, core, context, calls, writes, messages, outputs, prs, runs,
    execute: dryRun => run({ github, core, context, dryRun: dryRun ?? false }) };
}

const merges = f => f.writes.filter(call => call.method === 'pulls.merge');
const dispatches = f => f.writes.filter(call => call.method === 'actions.createWorkflowDispatch');

test('merges at most one ready PR at its exact head, then dispatches current-main CI', async () => {
  const f = fixture({ prs: [pull(2), pull(1)] });
  await f.execute();
  assert.equal(merges(f).length, 1);
  const args = merges(f)[0].args;
  assert.equal(args.pull_number, 1, 'select the oldest eligible PR regardless of API response order');
  assert.equal(args.sha, head(args.pull_number));
  assert.equal(args.merge_method, 'merge');
  assert.equal(dispatches(f).length, 1);
  assert.equal(dispatches(f)[0].args.workflow_id, 'core-journeys.yml');
  assert.equal(dispatches(f)[0].args.ref, 'main');
  assert.ok(f.writes.indexOf(merges(f)[0]) < f.writes.indexOf(dispatches(f)[0]));
});

test('merge methods prefer merge commits, fall back to squash, and never rebase', async t => {
  for (const [name, repository, expected] of [
    ['prefer merge', { allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: true }, 'merge'],
    ['squash fallback', { allow_merge_commit: false, allow_squash_merge: true, allow_rebase_merge: true }, 'squash'],
    ['rebase only is refused', { allow_merge_commit: false, allow_squash_merge: false, allow_rebase_merge: true }, null],
    ['no enabled method is refused', { allow_merge_commit: false, allow_squash_merge: false, allow_rebase_merge: false }, null],
  ]) await t.test(name, async () => {
    const f = fixture({ repository }); await f.execute();
    if (expected) {
      assert.equal(merges(f).length, 1); assert.equal(merges(f)[0].args.merge_method, expected);
    } else {
      assert.deepEqual(f.writes, []);
      assert.ok(f.messages.some(message => message.level === 'setFailed'));
    }
  });
});

test('explicit no-automerge hold forms block merging', async t => {
  for (const label of ['no-automerge', 'no auto merge', 'no_auto_merge']) await t.test(label, async () => {
    const f = fixture({ prs: [pull(1, { labels: [{ name: label }] })] });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('blocks draft, fork, unsupported base, holds, and requested reviewers', async t => {
  const variants = {
    draft: { draft: true },
    fork: { head: { ...pull().head, repo: { ...repoInfo(), full_name: 'stranger/fork' } } },
    branch: { base: { ...pull().base, ref: 'release/unsafe' } },
    title: { title: 'WIP: keep this open' },
    label: { labels: [{ name: 'do-not-merge' }] },
    reviewer: { requested_reviewers: [{ login: 'reviewer' }] },
    team: { requested_teams: [{ slug: 'review-team' }] },
  };
  for (const [name, changes] of Object.entries(variants)) await t.test(name, async () => {
    const f = fixture({ prs: [pull(1, changes)] }); await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('blocks protected file changes, including AGENTS.md below the root', async t => {
  for (const filename of ['.github/workflows/core-journeys.yml', '.github/scripts/helper.cjs', 'src/AGENTS.md']) {
    await t.test(filename, async () => {
      const f = fixture({ files: { 1: [{ filename }] } }); await f.execute(); assert.equal(merges(f).length, 0);
    });
  }
  await t.test('renaming protected file away', async () => {
    const f = fixture({ files: { 1: [{ filename: 'docs/old-ci.yml', previous_filename: '.github/workflows/ci.yml', status: 'renamed' }] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('an incomplete changed-file inventory cannot authorize a merge', async () => {
  const f = fixture({ prs: [pull(1, { changed_files: 3001 })] });
  await f.execute(); assert.equal(merges(f).length, 0);
});

test('blocks unresolved review threads, changes requested, and maintainer holds', async t => {
  const variants = {
    thread: { threads: { 1: [{ isResolved: false }] } },
    reviewDecision: { reviewDecision: { 1: 'CHANGES_REQUESTED' } },
    review: { reviews: { 1: [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'maintainer' }, submitted_at: time(100) }] } },
    comment: { comments: { 1: [{ id: 1, author_association: 'MEMBER', body: 'Please hold this change.' }] } },
  };
  for (const [name, options] of Object.entries(variants)) await t.test(name, async () => {
    const f = fixture(options); await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('review ordering preserves a change request until a newer decisive review clears it', async t => {
  const review = (id, state, seconds) => ({ id, state, user: { login: 'maintainer' }, submitted_at: time(seconds) });
  await t.test('later comment does not clear change request', async () => {
    const f = fixture({ reviews: { 1: [review(2, 'COMMENTED', 1), review(1, 'CHANGES_REQUESTED', 100)] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('later approval clears old change request', async () => {
    const f = fixture({ reviews: { 1: [review(1, 'CHANGES_REQUESTED', 100), review(2, 'APPROVED', 1)] } });
    await f.execute(); assert.equal(merges(f).length, 1);
  });
});

test('missing, pending, failing, and stale-head core CI cannot authorize a merge', async t => {
  const variants = {
    missing: [],
    pending: [workflow(101, head(1), 'mini/TASK-1', 'core-journeys.yml', { status: 'in_progress', conclusion: null })],
    failing: [workflow(101, head(1), 'mini/TASK-1', 'core-journeys.yml', { conclusion: 'failure' })],
    stale: [workflow(101, head(999), 'mini/TASK-1')],
    wrongPull: [workflow(101, head(1), 'mini/TASK-1', 'core-journeys.yml', {
      pull_requests: [{ number: 999, head: { sha: head(1) }, base: { sha: MAIN } }],
    })],
    newerPending: [workflow(101, head(1), 'mini/TASK-1'), workflow(102, head(1), 'mini/TASK-1', 'core-journeys.yml', {
      status: 'queued', conclusion: null, created_at: time(10), updated_at: time(5),
    })],
  };
  for (const [name, extraRuns] of Object.entries(variants)) await t.test(name, async () => {
    const f = fixture({ runs: [workflow(100, MAIN, 'main', 'core-journeys.yml', { event: 'push' }), ...extraRuns] });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('a successful workflow cannot hide a missing, skipped, or failing required job', async t => {
  for (const [name, jobs] of Object.entries({
    missing: [],
    skipped: [{ name: 'verify', status: 'completed', conclusion: 'skipped' }],
    failed: [{ name: 'verify', status: 'completed', conclusion: 'failure' }],
    pending: [{ name: 'verify', status: 'queued', conclusion: null }],
    wrongHead: [{ name: 'verify', status: 'completed', conclusion: 'success', head_sha: head(999) }],
  })) await t.test(name, async () => {
    const f = fixture({ jobs: { 101: jobs } }); await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('a head that does not contain the current base cannot merge', async t => {
  for (const status of ['behind', 'diverged']) await t.test(status, async () => {
    const f = fixture({ compare: status }); await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('applicable path-filtered workflow and its named job must succeed', async t => {
  for (const [filename, file, job] of [
    ['ops/symphony/runner.ts', 'codex-orchestration.yml', 'pipeline'],
    ['tools/symphony/local/runner.ts', 'symphony-throughput.yml', 'coordinator'],
  ]) await t.test(file, async () => {
    const missing = fixture({ files: { 1: [{ filename }] } }); await missing.execute(); assert.equal(merges(missing).length, 0);
    const ready = fixture({ files: { 1: [{ filename }] }, jobs: { 300: [{ name: job, head_sha: head(1), status: 'completed', conclusion: 'success' }] } });
    ready.runs.push(workflow(300, head(1), 'mini/TASK-1', file));
    await ready.execute(); assert.equal(merges(ready).length, 1);
  });
});

test('failed or pending extra checks block despite successful core CI', async t => {
  for (const check of [
    { name: 'security', status: 'completed', conclusion: 'failure', completed_at: time(1) },
    { name: 'security', status: 'queued', conclusion: null, started_at: time(1) },
  ]) await t.test(check.status, async () => {
    const f = fixture({ checks: { [head(1)]: [{ id: 500, head_sha: head(1), ...check }] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('check failures on the synthetic merge commit also block', async () => {
  const f = fixture({ checks: { [pull().merge_commit_sha]: [{ id: 501, name: 'integration',
    head_sha: pull().merge_commit_sha, status: 'completed', conclusion: 'failure', completed_at: time(1) }] } });
  await f.execute(); assert.equal(merges(f).length, 0);
});

test('same-named checks from different suites cannot hide one another', async () => {
  const f = fixture({ checks: { [head(1)]: [
    { id: 701, name: 'test', app: { id: 10 }, check_suite: { id: 1001 }, head_sha: head(1),
      status: 'completed', conclusion: 'failure', created_at: time(100) },
    { id: 702, name: 'test', app: { id: 10 }, check_suite: { id: 1002 }, head_sha: head(1),
      status: 'completed', conclusion: 'success', created_at: time(1) },
  ] } });
  await f.execute(); assert.equal(merges(f).length, 0);
});

test('commit statuses use the latest value per context even when API results are unordered', async t => {
  const status = (id, state, seconds) => ({ id, context: 'external-review', state, created_at: time(seconds), updated_at: time(seconds) });
  await t.test('new failure overrides old success', async () => {
    const f = fixture({ statuses: { [head(1)]: [status(1, 'success', 100), status(2, 'failure', 1)] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('new success replaces old failure', async () => {
    const f = fixture({ statuses: { [head(1)]: [status(1, 'failure', 100), status(2, 'success', 1)] } });
    await f.execute(); assert.equal(merges(f).length, 1);
  });
});

test('changed head or base during the final recheck prevents merging', async t => {
  await t.test('head', async () => {
    const f = fixture({ prSequence: { 1: [pull(), pull(1, { head: { ...pull().head, sha: head(2) } })] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('base', async () => {
    const f = fixture({ branchSequence: { main: [MAIN, MAIN, MAIN, MAIN, MAIN, head(999)] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('head on final read', async () => {
    const f = fixture({ prSequence: { 1: [pull(), pull(), pull(1, { head: { ...pull().head, sha: head(2) } })] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('human review requested on final read', async () => {
    const f = fixture({ prSequence: { 1: [pull(), pull(), pull(1, { requested_reviewers: [{ login: 'reviewer' }] })] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('team review requested on final read', async () => {
    const f = fixture({ prSequence: { 1: [pull(), pull(), pull(1, { requested_teams: [{ slug: 'review-team' }] })] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
});

test('a newly pending CI rerun discovered during reassessment prevents merging', async () => {
  const f = fixture();
  const original = f.github.rest.actions.listWorkflowRuns;
  let headReads = 0;
  f.github.rest.actions.listWorkflowRuns = async args => {
    if (args.head_sha === head(1) && ++headReads === 2) {
      const run = f.runs.find(run => run.head_sha === head(1)); run.status = 'in_progress'; run.conclusion = null;
    }
    return original(args);
  };
  await f.execute(); assert.equal(merges(f).length, 0); assert.ok(headReads >= 2);
});

test('missing current-main CI dispatches recovery only; pending CI is not duplicated', async t => {
  await t.test('missing', async () => {
    const f = fixture({ runs: [workflow(101, head(1), 'mini/TASK-1')] });
    await f.execute(); assert.equal(merges(f).length, 0); assert.equal(dispatches(f).length, 1);
    assert.equal(dispatches(f)[0].args.ref, 'main');
  });
  await t.test('pending', async () => {
    const f = fixture({ runs: [workflow(100, MAIN, 'main', 'core-journeys.yml', { event: 'push', status: 'queued', conclusion: null })] });
    await f.execute(); assert.equal(f.writes.length, 0);
  });
  await t.test('failed', async () => {
    const f = fixture({ runs: [workflow(100, MAIN, 'main', 'core-journeys.yml', { event: 'push', conclusion: 'failure' })] });
    await f.execute(); assert.equal(f.writes.length, 0);
  });
});

test('a GITHUB_TOKEN merge with failed CI dispatch is recovered on the next run without a second merge', async () => {
  const f = fixture({ dispatchFailures: 1, recordPendingDispatch: true });
  const first = await f.execute();
  assert.equal(first.merged, 1);
  assert.equal(merges(f).length, 1); assert.equal(dispatches(f).length, 1);
  assert.ok(f.messages.some(message => message.level === 'setFailed'));
  const second = await f.execute();
  assert.equal(second.merged, 0);
  assert.equal(merges(f).length, 1); assert.equal(dispatches(f).length, 2);
  assert.equal(dispatches(f)[1].args.ref, 'main');
  assert.ok(f.calls.some(call => call.method === 'actions.listWorkflowRuns' && call.args.head_sha === MERGED));
  await f.execute();
  assert.equal(dispatches(f).length, 2, 'a pending recovered dispatch is not duplicated');
});

test('REST and GraphQL pagination cannot hide a protected file or unresolved thread', async t => {
  await t.test('files', async () => {
    const f = fixture({ pageSize: 1, files: { 1: [{ filename: 'src/ok.ts' }, { filename: 'nested/AGENTS.md' }] } });
    await f.execute(); assert.equal(merges(f).length, 0);
  });
  await t.test('threads', async () => {
    const f = fixture({ pageSize: 1, threads: { 1: [{ isResolved: true }, { isResolved: false }] } });
    await f.execute(); assert.equal(merges(f).length, 0);
    assert.ok(f.calls.filter(call => call.method === 'graphql').length >= 2);
  });
});

test('candidate pagination reaches a ready PR after a blocked earlier candidate', async () => {
  const f = fixture({ pageSize: 1, prs: [pull(1, { draft: true }), pull(2)] });
  await f.execute(); assert.equal(merges(f).length, 1); assert.equal(merges(f)[0].args.pull_number, 2);
  assert.ok(f.calls.some(call => call.method === 'pulls.list' && call.args.page === 2));
});

test('dry run writes neither merges nor CI recovery dispatches', async t => {
  await t.test('ready PR', async () => { const f = fixture(); await f.execute(true); assert.deepEqual(f.writes, []); });
  await t.test('missing main CI', async () => {
    const f = fixture({ runs: [] }); await f.execute(true); assert.deepEqual(f.writes, []);
  });
});

test('the named sprint branch is eligible and does not dispatch main CI after merging', async () => {
  const pr = pull(1, { base: { ...pull().base, ref: SPRINT, sha: SPRINT_SHA } });
  const f = fixture({ prs: [pr] }); await f.execute();
  assert.equal(merges(f).length, 1);
  assert.equal(dispatches(f).length, 0, 'sprint merge does not pretend main changed');
});
