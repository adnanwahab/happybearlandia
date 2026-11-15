const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergedIssue, syncMergedPR } = require('../.github/scripts/sync-merged-pr.cjs');
const repository = 'adnanwahab/happybearlandia';
function event(ref = 'mini/SHE-182-r2') {
  return { action: 'closed', repository: { full_name: repository }, pull_request: {
    merged: true, number: 300, head: { ref, repo: { full_name: repository } },
    base: { repo: { full_name: repository } }, title: 'SHE-999', body: 'SHE-888',
  } };
}
test('original and revision branches map to original issue only', () => {
  for (const ref of ['mini/SHE-182', 'mini/SHE-182-r1', 'mini/SHE-182-r12']) {
    assert.equal(mergedIssue(event(ref), repository).identifier, 'SHE-182');
  }
  for (const ref of ['mini/SHE-182-r0', 'mini/SHE-182-r', 'mini/SHE-182-r2-extra',
    'mini/SHE-182-r2\n', 'mini/SHE-0', 'other/SHE-182', 'mini/SHE-182-r-1']) {
    assert.equal(mergedIssue(event(ref), repository), null);
  }
});
test('closed without merge, forks, missing repositories and wrong event never call Linear', async () => {
  const variants = [e => e.pull_request.merged = false, e => e.action = 'opened',
    e => e.pull_request.head.repo.full_name = 'fork/repo', e => e.pull_request.head.repo = null,
    e => e.pull_request.base.repo.full_name = 'other/repo', e => e.repository.full_name = 'other/repo'];
  for (const change of variants) {
    const e = event(); change(e);
    assert.deepEqual(await syncMergedPR({ event: e, repository,
      fetchImpl: () => assert.fail('unexpected network') }), { status: 'skipped' });
  }
});
test('entry point links canonical URL and repeat delivery uses identical attachment', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.linear.app/graphql');
    assert.equal(options.headers.Authorization, 'fixture');
    const request = JSON.parse(options.body); requests.push(request);
    return { ok: true, json: async () => ({ data: request.query.startsWith('query')
      ? { issue: { id: 'uuid', identifier: 'SHE-182' } } : { attachmentCreate: { success: true } } }) };
  };
  for (let i = 0; i < 2; i++) assert.deepEqual(await syncMergedPR({ event: event(), repository,
    token: 'fixture', fetchImpl }), { status: 'linked', identifier: 'SHE-182' });
  assert.deepEqual(requests[1], requests[3]);
  assert.equal(requests[1].variables.input.url, `https://github.com/${repository}/pull/300`);
  assert.equal(requests[0].variables.id, 'SHE-182');
  assert.ok(requests.every(r => !/issueUpdate|commentCreate/.test(r.query)));
});
test('missing secret holds before network', async () => {
  await assert.rejects(syncMergedPR({ event: event(), repository,
    fetchImpl: () => assert.fail('unexpected network') }), /repository secret/);
});
test('rejections, uncertain writes and mismatched identities fail closed without response leaks', async () => {
  for (const response of [ { ok: false }, { ok: true, json: async () => ({ errors: [{ message: 'PRIVATE' }] }) },
    { ok: true, json: async () => ({ data: { issue: { id: 'uuid', identifier: 'SHE-999' } } }) },
    { ok: true, json: async () => { throw Error('PRIVATE'); } } ]) {
    await assert.rejects(syncMergedPR({ event: event(), repository, token: 'fixture',
      fetchImpl: async () => response }), error => !error.message.includes('PRIVATE'));
  }
  await assert.rejects(syncMergedPR({ event: event(), repository, token: 'fixture',
    fetchImpl: async () => { throw Error('PRIVATE'); } }), /transport failed/);
  let calls = 0;
  await assert.rejects(syncMergedPR({ event: event(), repository, token: 'fixture',
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: ++calls === 1
      ? { issue: { id: 'uuid', identifier: 'SHE-182' } } : { attachmentCreate: { success: false } } }) })
  }), /not confirmed/);
});

test('missing event or repository fails closed', async () => {
  for (const [e, repo] of [[null, repository], [event(), undefined], [event(), ''], [event(), '../repo']]) {
    assert.deepEqual(await syncMergedPR({ event: e, repository: repo,
      fetchImpl: () => assert.fail('unexpected network') }), { status: 'skipped' });
  }
});

test('legacy CLI links revision evidence without closing issues and sanitizes failures', () => {
  const { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join, resolve } = require('node:path');
  const { spawnSync } = require('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'she182-'));
  try {
    const eventPath = join(directory, 'event.json');
    const preload = join(directory, 'fetch.cjs');
    writeFileSync(preload, `global.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      if (/issueUpdate/.test(request.query)) throw Error('completion mutation');
      if (process.env.FAIL_FIXTURE) throw Error('PRIVATE');
      return { ok: true, json: async () => ({data: request.query.startsWith('query')
        ? {issue: {id:'uuid', identifier:'SHE-182'}} : {attachmentCreate:{success:true}}}) };
    };`);
    const invoke = (e, extra = {}) => {
      writeFileSync(eventPath, JSON.stringify(e));
      return spawnSync(process.execPath, ['--require', preload, resolve('scripts/linear-close-merged-mini-pr.mjs')], {
        encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: repository, LINEAR_API_KEY: 'fixture', ...extra } });
    };
    const linked = invoke(event('mini/SHE-182-r3'));
    assert.equal(linked.status, 0, linked.stderr);
    assert.deepEqual(JSON.parse(linked.stdout), {status:'linked',identifier:'SHE-182'});
    const fork = event(); fork.pull_request.head.repo.full_name = 'fork/repo';
    const skipped = invoke(fork, {LINEAR_API_KEY:''});
    assert.equal(skipped.status, 0);
    assert.deepEqual(JSON.parse(skipped.stdout), {status:'skipped'});
    for (const extra of [{LINEAR_API_KEY:''}, {FAIL_FIXTURE:'1'}]) {
      const failed = invoke(event(), extra);
      assert.equal(failed.status, 1);
      assert.doesNotMatch(failed.stderr, /PRIVATE/);
    }
    assert.equal(existsSync('.github/workflows/mini-symphony-close-linear.yml'), false);
    assert.match(readFileSync('.github/workflows/linear-merged-pr.yml', 'utf8'), /syncMergedPR/);
  } finally { rmSync(directory, {recursive:true,force:true}); }
});
