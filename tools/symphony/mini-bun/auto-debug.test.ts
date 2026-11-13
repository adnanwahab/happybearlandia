import {test,expect} from 'bun:test';
import {portFailureEvidence,shouldAutoDebug,parseAutoDebugResult,autoDebugPrompt} from './auto-debug';
test('explicit port conflicts classified without treating arbitrary test errors as a recovery trigger',()=>{
 expect(portFailureEvidence('error: AssertionError')).toBe('');
 expect(portFailureEvidence('error: Child server exited')).toBe('');
 expect(portFailureEvidence('\x1b[31merror: EADDRINUSE\x1b[0m')).toContain('EADDRINUSE');
 expect(portFailureEvidence('Failed to start server. Is port 0 in use?')).not.toBe('');
 expect(portFailureEvidence(Array(100).fill('EADDRINUSE '+ 'x'.repeat(1000)).join('\n')).length).toBeLessThanOrEqual(2408);
});
test('only one repair is eligible, default off and stop/timeout/spawn failure forbid recovery',()=>{
 const input={enabled:true,evidence:'EADDRINUSE',pass:0,stopping:false,timedOut:false,spawnError:'',remainingMs:100};
 expect(shouldAutoDebug(input)).toBe(true);
 for(const override of [{enabled:false},{evidence:''},{pass:1},{pass:2},{stopping:true},{timedOut:true},{spawnError:'missing codex'},{remainingMs:0}])expect(shouldAutoDebug({...input,...override})).toBe(false);
});
test('zero process exit is insufficient: structured validation must report passing checks',()=>{
 for(const text of ['', 'Tests passed', '{}', '{"status":"blocked"}', '{"status":"passed","command":"","summary":"ok"}'])expect(parseAutoDebugResult(text)).toBe(false);
 expect(parseAutoDebugResult('{"status":"passed","command":"bun test","summary":"checks passed"}')).toBe(true);
 const prompt=autoDebugPrompt('Task','EADDRINUSE');expect(prompt).toContain('Do not kill any processes');expect(prompt).toContain('PORT=0');expect(prompt).toContain('untrusted');
});
