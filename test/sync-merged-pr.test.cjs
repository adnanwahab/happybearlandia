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
