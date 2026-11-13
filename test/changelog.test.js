import {test, expect} from 'bun:test';
import {parseChangelog, MAX_BYTES} from '../ops/changelog.js';

// Entirely synthetic evidence; not a production release or live verification.
export function syntheticEntry() {
  const commit = 'a'.repeat(40);
  return {title:'Synthetic release',summary:'Test fixture only.',pr:{number:123,mergedAt:'2026-01-01T00:00:00Z',mergeCommit:commit,url:'https://github.com/adnanwahab/happybearlandia/pull/123'},deployment:{version:commit,commit,deployedAt:'2026-01-02T00:00:00Z',verified:true,versionUrl:`https://github.com/adnanwahab/happybearlandia/commit/${commit}`,evidenceUrl:'https://github.com/adnanwahab/happybearlandia/actions/runs/123'}};
}
const parse = entries => parseChangelog(JSON.stringify({schemaVersion:1,entries}));
test('production manifest is honestly empty', async () => {
  expect(parseChangelog(await Bun.file('data/changelog.json').text())).toEqual([]);
});
test('accepts synthetic verified record and preserves exact evidence', () => {
  const e = syntheticEntry(); expect(parse([e])).toEqual([e]);
});
test('rejects missing merge/deployment, mismatched commit and unverified deployment', () => {
  for (const mutate of [e=>delete e.pr.mergedAt,e=>delete e.deployment,e=>e.deployment.verified=false,e=>e.deployment.commit='b'.repeat(40),e=>e.deployment.deployedAt='2025-01-01T00:00:00Z']) {
    const e=syntheticEntry(); mutate(e); expect(parse([e])).toEqual([]);
  }
});
test('rejects malformed metadata, versions, unsafe and misleading evidence URLs', () => {
  for (const mutate of [e=>e.title='',e=>e.summary='x'.repeat(601),e=>e.pr.number=1.2,e=>e.pr.mergedAt='2026-02-30T00:00:00Z',e=>e.deployment.version='latest',e=>e.deployment.evidenceUrl='javascript:alert(1)',e=>e.deployment.evidenceUrl=e.deployment.evidenceUrl.replace('github.com','githubXcom'),e=>e.pr.url+='?x',e=>e.deployment.versionUrl='https://github.com.evil.test/commit/abc',e=>e.deployment.evidenceUrl+='?token=secret',e=>e.extra=true,e=>e.pr=null]) {
    const e=syntheticEntry();mutate(e);expect(parse([e])).toEqual([]);
  }
  expect(parse([null,{},'invalid'])).toEqual([]);
});
test('bounds and validates envelope and rejects duplicate releases', () => {
  for(const raw of ['{','null',JSON.stringify({schemaVersion:2,entries:[]}),JSON.stringify({schemaVersion:1,entries:Array(101).fill(null)}),' '.repeat(MAX_BYTES+1)]) expect(()=>parseChangelog(raw)).toThrow();
  expect(()=>parse([syntheticEntry(),syntheticEntry()])).toThrow();
});
test('orders releases newest first without mutating input', () => {
  const a=syntheticEntry(), b=syntheticEntry();
  b.deployment.commit=b.deployment.version=b.pr.mergeCommit='b'.repeat(40);
  b.deployment.versionUrl=`https://github.com/adnanwahab/happybearlandia/commit/${b.deployment.commit}`;
  b.deployment.deployedAt='2026-01-03T00:00:00Z';
  expect(parse([a,b])).toEqual([b,a]);
});
