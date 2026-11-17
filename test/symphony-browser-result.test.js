import {test,expect} from 'bun:test';
import {browserJobStatus,redactBrowserEndpoints} from '../scripts/support/browser-job-result.mjs';
test('browser results cannot turn absent, skipped, flaky or failed coverage into passing acceptance',()=>{
 expect(browserJobStatus(0,{expected:6,skipped:0,flaky:0,unexpected:0})).toBe('passed');
 for(const stats of [undefined,{}, {expected:0},{expected:6,skipped:1},{expected:6,flaky:1},{expected:6,unexpected:1}])expect(browserJobStatus(0,stats)).toBe('incomplete');
 expect(browserJobStatus(1,{expected:6})).toBe('failed');expect(browserJobStatus(null,{expected:6})).toBe('failed');
});

test('artifact endpoint redaction preserves all test outcomes',()=>{
 const report={stats:{expected:1},projects:[{use:{connectOptions:{wsEndpoint:'ws://localhost/capability'}}}]};
 expect(redactBrowserEndpoints(report)).toEqual({stats:{expected:1},projects:[{use:{connectOptions:{wsEndpoint:'[redacted]'}}}]});
 expect(report.projects[0].use.connectOptions.wsEndpoint).toBe('ws://localhost/capability');
});
