import {test,expect} from 'bun:test';
import {createPopulationModel,serializePopulation} from './model.js';
import {createPopulationRuntime} from './runtime.js';
import {readPopulationCheckpoint} from './checkpoint.js';

test('fresh morning initializes without overnight activity, money flows, trips or needs changes',()=>{
 const midnight=createPopulationModel({population:80,seed:42}),morning=createPopulationModel({population:80,seed:42},{},{initialMinute:360,initialTick:360});
 expect(morning.minute).toBe(360);expect(morning.tick).toBe(360);expect(morning.lastDay).toBe(0);expect(morning.people).toEqual(midnight.people);expect(morning.households).toEqual(midnight.households);expect(morning.totals).toEqual(midnight.totals);expect(morning.employment.totals).toEqual(midnight.employment.totals);expect(morning.activityHistory.totals.agentMinutes).toBe(0);expect(morning.activityHistory.selected[`${morning.prefix}-p0`].trackingStartedMinute).toBe(360);expect(morning.provenance.initialization.history).toContain('No simulated prehistory');expect(midnight.minute).toBe(0);expect(midnight.provenance.initialization).toBeUndefined();
});

test('worker emits only 6am or later and accounts every subsequent minute; checkpoint restores the fresh origin',async()=>{
 const minutes=[],a=createPopulationRuntime({config:{population:80,seed:43},initialMinute:360,stepMinutes:1,clockMode:'minutes-per-second',onUpdate:f=>{if(f)minutes.push(f.minute);}}),b=createPopulationRuntime({config:{population:30}});
 try{await Promise.all([a.ready,b.ready]);expect(minutes).toEqual([360]);expect(a.getSnapshot().minute).toBe(360);expect(a.getSnapshot().resetProvenance.initialMinute).toBe(360);const initial=readPopulationCheckpoint(await a.exportCheckpoint());expect(initial.model.activityHistory.totals.agentMinutes).toBe(0);await a.step();const saved=await a.exportCheckpoint(),state=readPopulationCheckpoint(saved);expect(state.model.minute).toBe(361);expect(state.model.activityHistory.totals.agentMinutes).toBeCloseTo(80);expect(state.model.activityHistory.coverage.fromMinute).toBe(360);await b.restoreCheckpoint(JSON.parse(JSON.stringify(saved)));await a.step();await b.step();expect(readPopulationCheckpoint(await b.exportCheckpoint())).toEqual(readPopulationCheckpoint(await a.exportCheckpoint()));const before=await a.exportCheckpoint();await expect(a.stepToTime(0)).rejects.toThrow();expect(await a.exportCheckpoint()).toEqual(before);await a.updateConfig({population:80,seed:43});expect(a.getSnapshot().minute).toBe(360);expect(readPopulationCheckpoint(await a.exportCheckpoint()).model.activityHistory.totals.agentMinutes).toBe(0);
 }finally{a.destroy();b.destroy();}
});

test('fresh origin validates clock alignment and first-day bounds',()=>{
 for(const initialMinute of [-1,1440,1.5])expect(()=>createPopulationModel({}, {},{initialMinute})).toThrow();expect(()=>createPopulationRuntime({initialMinute:361,stepMinutes:30})).toThrow();
});

test('morning future manifests and replay use the same absolute initial tick and minute',async()=>{
 const runtime=createPopulationRuntime({config:{population:40,seed:42},initialMinute:360,stepMinutes:1,clockMode:"minutes-per-second"});try{await runtime.ready;const result=await runtime.runExperiments({runs:1,horizonDays:1}).ready;expect(result.status).toBe('completed');expect(result.manifest.initialMinute).toBe(360);expect(result.manifest.pairing.policyAppliedFromMinute).toBe(360);const row=result.rows[0];expect(row.summary.timeSeries[0].minute).toBe(360);const frame=await runtime.replayFuture(row,result.manifest);expect(frame.minute).toBe(1800);expect(frame.metrics).toEqual(row.summary.metrics);expect(readPopulationCheckpoint(await runtime.exportCheckpoint()).runtime.stepMinutes).toBe(30);}finally{runtime.destroy();}
},30000);
