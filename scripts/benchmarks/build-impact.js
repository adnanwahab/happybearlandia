import { buildImpactLines } from '../../world/decision/build-impact.js';
import { createBuildingProposal } from '../../world/buildings/proposal.js';
const before={projects:Array.from({length:64},(_,i)=>createBuildingProposal({id:`bench-${i}`,status:'approved'}))};
const after=structuredClone(before); after.projects[63].finance.estimatedCost++;
for(let i=0;i<100;i++)buildImpactLines(before,after);
const samples=[];
for(let i=0;i<1000;i++){const start=performance.now();buildImpactLines(before,after);samples.push(performance.now()-start);}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({interaction:'64-project input cost/timing summary only; excludes validation, DOM and rendering',runtime:Bun.version,samples:samples.length,medianMs:samples[500],p95Ms:samples[950]},null,2));
