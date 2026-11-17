import { scenario, stepCPU, MODEL, RULES } from '../world/microagents/model.js';
import { createHash } from 'node:crypto';
const s=scenario(); let energy=s.energy;
const frames=[];
for(let tick=1;tick<=3;tick++) {
 const start=performance.now(), r=stepCPU(s,energy);
 const cpuMs=performance.now()-start;
 frames.push({tick,cpuMs,updatedAgentCount:r.energy.filter((v,i)=>v!==energy[i]).length,
  directedContactEvaluations:r.contacts.reduce((a,b)=>a+b,0),
  stateSHA256:createHash('sha256').update(r.energy).digest('hex')});
 energy=r.energy;
}
console.log(JSON.stringify({model:MODEL,rules:RULES,source:'synthetic/un-calibrated',
 seed:s.seed,count:s.count,machine:process.platform+' '+process.arch,runtime:Bun.version,frames},null,2));
