import {test,expect} from 'bun:test';
import {deriveRealityWorkflowState,getWeeklyRealityChallenge} from '../world/reality/workflow.js';
import {compileRealityProposal} from '../world/reality/compiler.js';
test('journey exposes actual completed futures and selected index without invented outcomes',()=>{
 const empty=deriveRealityWorkflowState();expect(empty.completed).toBe(0);expect(empty.stages.filter(x=>x.available).map(x=>x.id)).toEqual(['home']);
 const source={program:{id:'p',executable:true},result:{manifest:{runs:100},runs:[{runId:'a',status:'completed'},{runId:'b',status:'error'},{runId:'c',status:'completed'}]},replay:{runId:'c'},analysis:null,branchCount:1},saved=structuredClone(source),state=deriveRealityWorkflowState(source);
 expect(state.completed).toBe(2);expect(state.requested).toBe(100);expect(state.selectedIndex).toBe(2);expect(state.stages.find(x=>x.id==='enter').status).toBe('Entered Future 2 · 2 retained completed outcomes');expect(state.stages.find(x=>x.id==='debug').complete).toBe(false);expect(state.stages.find(x=>x.id==='fork').complete).toBe(false);expect(state.stages.find(x=>x.id==='compare').complete).toBe(false);expect(source).toEqual(saved);
 expect(deriveRealityWorkflowState({...source,replay:{runId:'missing'}}).stages.find(x=>x.id==='share').available).toBe(false);
});
test('challenge and branch completion use supplied evidence, not elapsed time',()=>{
 const state=deriveRealityWorkflowState({program:{executable:true},analysis:{evaluations:[{id:'actual'}]},branchCount:3});expect(state.stages.find(x=>x.id==='debug').complete).toBe(true);expect(state.stages.find(x=>x.id==='fork').status).toBe('3 local policy branches');expect(state.stages.find(x=>x.id==='share').available).toBe(false);
});
test('local weekly challenges rotate on UTC Monday with supported bounded proposals and defensive copies',()=>{
 const first=getWeeklyRealityChallenge('2026-11-02T00:00:00Z'),last=getWeeklyRealityChallenge('2026-11-08T23:59:59Z'),next=getWeeklyRealityChallenge('2026-11-09T00:00:00Z');expect(first).toEqual(last);expect(first.id).not.toBe(next.id);expect(first.seed).not.toBe(next.seed);expect(first.seed).toBeGreaterThanOrEqual(0);expect(first.seed).toBeLessThanOrEqual(4294967295);
 for(let i=0;i<3;i++){const row=getWeeklyRealityChallenge(new Date(Date.UTC(2026,10,2+7*i))),program=compileRealityProposal(row.proposal);expect(program.executable).toBe(true);expect(program.engine).toBe(row.engine);expect(row.runs).toBeLessThanOrEqual(row.bounds.runs[1]);expect(row.months??row.minutes).toBeLessThanOrEqual(row.months?row.bounds.months[1]:row.bounds.minutes[1]);}
 first.bounds.runs[1]=9999;expect(getWeeklyRealityChallenge('2026-11-02').bounds.runs[1]).toBe(100);expect(()=>getWeeklyRealityChallenge('bad')).toThrow();
});

test('shared future retains its original number when only one outcome is saved',()=>{const state=deriveRealityWorkflowState({result:{manifest:{runs:100},runs:[{runId:'future37',runIndex:36,status:'completed'}]},replay:{runId:'future37'}});expect(state.completed).toBe(1);expect(state.selectedIndex).toBe(37);expect(state.stages.find(s=>s.id==='enter').status).toContain('Future 37');});
