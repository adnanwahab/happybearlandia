import {test, expect} from 'bun:test';
import {aggregateFirstPlay, STAGES} from '../tools/first-play/aggregate.js';
const event=(id,sessionId,type,minute=0,bot=false)=>({id,sessionId,type,bot,timestamp:new Date(Date.UTC(2026,10,12,0,minute)).toISOString()});
const fixture=events=>({schemaVersion:'first-play-export.v1',kind:'synthetic-fixture',source:'Hand-counted test fixture',observationStart:'2026-11-12T00:00:00Z',observationEnd:'2026-11-14T00:00:00Z',events});
test('hand-counted funnel, duplicates, out-of-order input, cohorts and bots',()=>{
 const rows=STAGES.map((s,i)=>event(`a${i}`,'a',s,i));
 rows.push(event('b0','b','landing'),event('b1','b','start',1),event('b2','b','first_change',2),event('c','c','share'),event('bot0','bot','landing'),event('bot1','bot','start',1,true),rows[0]);
 const report=aggregateFirstPlay(fixture(rows.reverse()));
 expect(report.stages.map(r=>r.sessions)).toEqual([2,2,1,1,1,1]);
 expect(report.stages.map(r=>r.events)).toEqual([2,2,1,2,2,1]);
 expect(report.stages.map(r=>r.conversion)).toEqual([null,1,.5,1,1,1]);
 expect(report.cohorts).toEqual([{date:'2026-11-12',landingSessions:2,startedSessions:2,changedSessions:1}]);
 expect(report.duplicateEvents).toBe(1);expect(report.excludedBotSessions).toBe(1);
 expect(report.retention.day1).toBeNull();expect(report.retention.day7).toBeNull();
 expect(aggregateFirstPlay(fixture(rows))).toEqual(report);
});
test('empty export has no invented conversions or retention',()=>{
 const report=aggregateFirstPlay(fixture([]));expect(report.stages.every(r=>r.sessions===0&&r.conversion===null)).toBe(true);expect(report.cohorts).toEqual([]);
 expect(()=>aggregateFirstPlay(null)).toThrow();
});
test('invalid classification, conflicting duplicate, period boundary fail closed',()=>{
 const row=event('1','a','landing');
 for(const changed of [{...row,bot:undefined},{...row,timestamp:'2026-11-14T00:00:00Z'},{...row,type:'invented'}])expect(()=>aggregateFirstPlay(fixture([changed]))).toThrow();
 expect(()=>aggregateFirstPlay(fixture([row,{...row,type:'start'}]))).toThrow('Conflicting');
});
test('repeated transitions and missing preceding stages never inflate ordered sessions',()=>{
 const report=aggregateFirstPlay(fixture([event('1','a','start'),event('2','a','landing',1),event('3','a','landing',2),event('4','a','choice',3)]));
 expect(report.stages.map(r=>r.sessions)).toEqual([1,0,0,0,0,0]);
});
