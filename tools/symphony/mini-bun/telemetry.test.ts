import { test, expect } from 'bun:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSessionTelemetry } from './telemetry';
import { summarizeSession } from './session-metrics.js';
import { redactTelemetry } from './telemetry-format.js';
test('curated text/event logs are ordered, redacted and independent from raw worker transcripts',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'mini-telemetry-'));
 try {
  const log=await createSessionTelemetry({root,name:'Fixture',repository:'fixture/repo',heartbeatMs:10});
  log.activity('SHE-1','working');
  await log.event('task_started','Worker starts.',{attempt:1},'SHE-1');
  await log.event('diagnostic','Bearer private-auth-credential github_pat_12345678901234567890 /Users/private/person/file',{nested:{secret:'must not persist'}},'SHE-1');
  await Bun.sleep(25);
  await log.event('task_finished','Exit is not acceptance.',{status:'no_changes',code:0,attempt:1},'SHE-1');
  log.activity('SHE-1',null);await log.stop('external_SIGINT');
  const events=(await readFile(path.join(log.dir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  const text=await readFile(path.join(log.dir,'session.log'),'utf8');
  expect(events.map(e=>e.seq)).toEqual(events.map((_,i)=>i));
  expect(text).toContain('session_started');expect(text).toContain('session_stopped');
  expect(text).not.toContain('private-auth-credential');expect(text).not.toContain('github_pat_123');expect(text).not.toContain('/Users/private');
  expect(JSON.stringify(events)).not.toContain('must not persist');
  const metric=summarizeSession(events);expect(metric.hasStop).toBe(true);expect(metric.codingMs).toBeGreaterThan(0);expect(metric.noChanges).toBe(1);expect(metric.reachedRuntimeTarget).toBe(false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('separate starts create separate evidence directories and redact URL credentials',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'mini-sessions-'));
 try{const first=await createSessionTelemetry({root,name:'Fixture',repository:'fixture/repo'});await first.stop('done');const second=await createSessionTelemetry({root,name:'Fixture',repository:'fixture/repo'});await second.stop('done');expect(first.sessionId).not.toBe(second.sessionId);expect((await readdir(path.join(root,'telemetry/sessions'))).length).toBe(2);expect(redactTelemetry('postgres://user:password@host/db')).not.toContain('user:password');}
 finally{await rm(root,{recursive:true,force:true});}
});
