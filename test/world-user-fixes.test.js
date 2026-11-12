import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {withHistoryDeadline} from '../world/activity-dashboard.js';
import {formatOutcomeSummary} from '../world/reality/outcome-feedback.js';
import {EXPERIENCES} from '../world/universe/registry.js';

test('history deadline rejects stalled calls and a later retry still succeeds',async()=>{
 await expect(withHistoryDeadline(()=>new Promise(()=>{}),5)).rejects.toThrow('Apply filters or reopen Activity to retry');
 expect(await withHistoryDeadline(()=>({buckets:[]}),20)).toEqual({buckets:[]});
 await expect(withHistoryDeadline(()=>{throw Error('worker failed');},20)).rejects.toThrow('worker failed');
});
test('policy goal failures preserve completed and execution error counts',()=>{
 const summary=formatOutcomeSummary({requested:100,completed:100,passed:0,failed:100,errors:0});
 expect(summary).toContain('100/100 requested pairs completed; 0 execution errors');
 expect(summary).toContain('100 nonpassing');
});
test('homepage flagship and catalog use existing registered routes',()=>{
 const home=readFileSync('index.html','utf8'),directory=readFileSync('routes.html','utf8');
 expect(home).toContain('href="/world/future-machine.html?demo=1">Play Demo');
 expect(EXPERIENCES).toHaveLength(31);
 expect(new Set(EXPERIENCES.map(row=>row.route)).size).toBe(EXPERIENCES.length);
 expect(directory).toContain('import {EXPERIENCES}');
});
