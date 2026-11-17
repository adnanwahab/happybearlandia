// SHE-245 reproducible synthetic evidence; never writes application state.
import { resolveHousingModel, createHousingScenarios } from '../world/models/housing/index.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const path = new URL('../docs/evidence/she-245-housing-run.json', import.meta.url);
function produce() {
  const model = resolveHousingModel('1.2.0');
  const scenario = createHousingScenarios().find(row => row.id === 'plan-a');
  // Fixed parameters, no uncertainty sampling. Explicit ID avoids random UUIDs.
  const input = {parameters: scenario.parameters, seed: 42, years: 10,
    projects: [createBuildingProposal({id:'audit-housing-001',status:'approved'})], scheduledStress: []};
  const output = model.simulateRun(input);
  return {schemaVersion:'housing-audit-evidence.v1', modelId:model.id, modelVersion:model.version,
    source:'Synthetic defaults and plan-a parameters; no empirical calibration; project placement is synthetic local meters.',
    input, output, outputSha256:createHash('sha256').update(JSON.stringify(output)).digest('hex')};
}
const actual = produce();
if (process.argv.includes('--write')) writeFileSync(path, JSON.stringify(actual,null,2)+'\n');
else assert.deepStrictEqual(actual, JSON.parse(readFileSync(path,'utf8')));
assert.equal(actual.output.monthlyTimeline.length,121);
assert.equal(actual.output.timeline.length,11);
assert.ok(Math.abs(actual.output.accounting.initialHousing + actual.output.accounting.completedHomes - actual.output.accounting.demolishedHomes - actual.output.accounting.finalHousing)<1e-6);
console.log(JSON.stringify({verified:true,sha256:actual.outputSha256,metrics:actual.output.metrics}));
