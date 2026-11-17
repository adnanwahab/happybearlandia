/** Versioned orchestration only: City rules, RNG and metric contracts are unchanged. */
import {createCity} from '../city/seed.js';
import {scheduleShock} from '../city/engine.js';
import {createChallengeEnvelope, validateChallengeEnvelope, verifyChallenge} from './contract.js';

export const DRILL_VERSION = 'crisis-drill.v1';
export const CHOICES = Object.freeze([
  Object.freeze({id:'reserve', label:'Reserve funds', detail:'No new project; retain resources for needs this toy does not model.'}),
  Object.freeze({id:'drainage', label:'Prepare drainage', detail:'Add 0.4 Riverside resilience for 3,000 synthetic USD; construction may miss the flood.'}),
  Object.freeze({id:'homes', label:'Commission two homes', detail:'Two Riverside homes for 4,000 synthetic USD; delivery is subject to construction gates.'}),
]);
export const OBJECTIVES = 'At month 12: at most one unhoused household, and no more unhoused households or experienced commute minutes than the matched reserve branch; cumulative public capital expense at most 4,000 synthetic USD. All three conditions required per seed. No welfare or moral verdict.';
const freeze = value => {if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);

export async function createDemoDrill() {
  const challenges = await Promise.all([42,73,101].map(seed => {
    const initial=createCity({seed,households:12});
    // Authored isolation assumption: prohibit unrelated private redevelopment.
    initial.parcels.forEach(parcel=>{parcel.capacity=0;});
    return createChallengeEnvelope({
    initialState:scheduleShock(initial, {type:'flood',districtId:'d1',start:10,duration:3,severity:0.7}),
    months:12, budget:4000, title:'Riverside preparedness · crisis-drill.v1',
    metrics:['unhousedHouseholds','meanExperiencedCommuteMinutes'],
    guards:{populationNotBelowReference:false,unhousedNotAboveReference:false,employmentNotBelowReference:false},
    actions:[{id:'drainage',label:'Prepare drainage',intervention:{type:'resilience',districtId:'d1',amount:0.4,cost:3000}},
      {id:'homes',label:'Commission two homes',intervention:{type:'housing',districtId:'d1',amount:2,cost:4000}}],
  });}));
  return freeze({schemaVersion:DRILL_VERSION,scenarioId:'riverside-preparedness.v1',objectives:OBJECTIVES,challenges});
}

export async function validateDrill(input) {
  if(!input)throw Error('No source data. Load the pinned authored demo; no results inferred.');
  // This bounded slice accepts only its authored recipe; no fuzzy migration or substitute seed.
  const snapshot=structuredClone(input), expected=await createDemoDrill();
  if(canonical(snapshot)!==canonical(expected))throw Error('Source replay mismatch: scenario, model, seed or objectives differ from the pinned demo.');
  for(const c of snapshot.challenges)await validateChallengeEnvelope(c);
  return freeze(snapshot);
}

export function gradeRun(run) {
  const missing=['unhousedHouseholds','meanExperiencedCommuteMinutes'].filter(id=>{
    const metric=run.metrics.find(m=>m.id===id);
    return !metric || metric.status!=='available' || !Number.isFinite(metric.reference) || !Number.isFinite(metric.candidate);
  });
  if(!Number.isFinite(run.budget?.candidateSpent) || !Number.isFinite(run.budget?.referenceSpent))missing.push('capitalExpense');
  if(missing.length)return {status:'unavailable',missing};
  return {status:run.metrics.find(m=>m.id==='unhousedHouseholds')?.candidate<=1 && run.metrics.every(m=>m.noWorse) && run.budget.referenceWithinCap && run.budget.candidateWithinCap ? 'objectives-met':'objectives-not-met',missing};
}

export async function runDrill(input, choice, {signal,onProgress}={}) {
  const scenario=await validateDrill(input);
  if(!CHOICES.some(c=>c.id===choice))throw Error('Choose exactly one of the three authored responses.');
  const runs=[];
  for(const challenge of scenario.challenges) {
    if(signal?.aborted)throw new DOMException('Drill cancelled; no completed decision recorded.','AbortError');
    const result=await verifyChallenge(challenge,{selection:choice==='reserve'?[]:[choice]},{signal,onProgress});
    runs.push({seed:challenge.seed,grade:gradeRun(result),result});
  }
  if(signal?.aborted)throw new DOMException('Drill cancelled; no completed decision recorded.','AbortError');
  return freeze({schemaVersion:'crisis-receipt.v1',scenario,choice,runs,
    uncertainty:'Three authored matched seeds, not a probability sample. Missing outcomes remain unavailable. Structural and real-world uncertainty unquantified; measured observations absent.',
    provenance:'Synthetic City toy outputs. Flood warning is scripted flavor; no observed emergency or resident endorsement. Final checkpoints and initial states retain City identities and integer months.'});
}

export async function replayDrill(receipt, options={}) {
  const saved=structuredClone(receipt);
  if(saved?.schemaVersion!=='crisis-receipt.v1')throw Error('Replay mismatch: unsupported receipt.');
  const replay=await runDrill(saved.scenario,saved.choice,options);
  if(canonical(replay)!==canonical(saved))throw Error('Replay mismatch: recorded outcomes differ. History retained; no verified result inferred.');
  return replay;
}
