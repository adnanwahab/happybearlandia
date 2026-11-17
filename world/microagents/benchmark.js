import { MODEL, RULES, scenario, stepCPU } from './model.js';
import { createGPU } from './gpu.js';
export async function benchmark({ counts = [10000,100000,1000000], ticks = 3, seed = 143 } = {}) {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 100) throw new Error('Invalid ticks');
  const report = { schema:'architecture-a-benchmark.v1', model:MODEL, rules:RULES, seed,
    source:'synthetic/un-calibrated', clock:'one synchronous rule application per tick',
    machine:navigator.userAgent, observedAt:new Date().toISOString(), scenarios:[] };
  for (const count of counts) {
    const row={count,ticks,status:'failed',frames:[]}; report.scenarios.push(row);
    let gpu;
    try {
      const started=performance.now(), s=scenario({count,seed});
      row.indexBuildMs=performance.now()-started;
      gpu=await createGPU(s); row.device=gpu.metadata;
      let previous=s.energy;
      for(let tick=0;tick<ticks;tick++) {
        const actual=await gpu.step();
        let mismatch=null;
        if(count===10000) {
          const expected=stepCPU(s,previous); mismatch=0;
          for(let i=0;i<count;i++) if(expected.energy[i]!==actual.energy[i] || expected.contacts[i]!==actual.contacts[i]) mismatch++;
          previous=expected.energy;
        }
        let interactions=0, updated=0;
        for(let i=0;i<count;i++) {interactions+=actual.contacts[i]; if(actual.energy[i] > 1023 || actual.contacts[i]>s.cap || actual.updated[i]!==1) throw new Error('GPU invariant'); updated++;}
        row.frames.push({tick:actual.tick,updatedAgentCount:updated,actualDirectedInteractions:interactions,
          gpuPassMs:actual.gpuPassMs,submitReadbackMs:actual.submitReadbackMs,oracleMismatch:mismatch,
          counts:{residentRecords:count,independentlyUpdatedStates:updated,eventDrivenUpdates:0,modeledPairwiseInteractions:null,visibleAvatars:0,aggregateCohortWeight:0}});
        if(mismatch) throw new Error('CPU/GPU mismatch');
      }
      row.status='completed';
    } catch(e) {row.error=String(e);} finally {gpu?.destroy();}
  }
  return report;
}
