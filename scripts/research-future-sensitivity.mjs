import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {housingProjectBuildingId,validateState} from '../world/city/contracts.js';
import {DEFAULT_RECIPE,MODEL_VERSION,MONTHS} from '../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay,validateRecipe} from '../world/future-machine/data/index.js';
import {freeze,stateHash} from '../world/future-machine/data/core.js';
import {compareFrame} from '../world/future-machine/diff/index.js';

export const DEFAULT_PROTOCOL=Object.freeze({seeds:Object.freeze([0,1,42,4294967295]),delays:Object.freeze([0,6,24])});
const metricKeys=['housingUnits','meanRent','capitalSpending'];
class ResearchCheckError extends Error {}
const requireCheck=(condition,message)=>{if(!condition)throw new ResearchCheckError(message);};

/** Independent inventory/ledger reconciliation, not another call to cityMetrics. */
export function reconcileHistory(history,initial){
 requireCheck(Array.isArray(history)&&history.length===MONTHS+1,'Expected all 121 recorded months');
 let capital=0;const seen=new Set(initial.buildings.map(row=>row.id)),seenUnits=new Set(initial.units.map(row=>row.id)),completions=[];
 for(let month=0;month<=MONTHS;month++){
  const snapshot=history[month],state=snapshot?.state;
  requireCheck(snapshot?.month===month&&state?.month===month,'Missing or mismatched month');
  requireCheck(state.seed===initial.seed&&state.version===MODEL_VERSION,'Mismatched seed or model');
  requireCheck(Array.isArray(state.units)&&Array.isArray(state.buildings)&&Array.isArray(state.projects),'Missing inventory');
  validateState(state);
  const rents=state.units.map(unit=>unit.rent);
  requireCheck(rents.every(Number.isFinite),'Missing or nonfinite inventory rent');
  const rent=rents.length?rents.reduce((total,value)=>total+value,0)/rents.length:0;
  requireCheck(snapshot.metrics?.housingUnits===state.units.length,'Homes disagree with recorded inventory');
  requireCheck(Number.isFinite(snapshot.metrics?.meanRent)&&Math.abs(snapshot.metrics.meanRent-rent)<1e-9,'Mean rent disagrees with recorded inventory');
  if(month){const ledger=state.systems?.finance?.capitalExpense;requireCheck(Number.isFinite(ledger),'Missing monthly capital ledger');capital+=ledger;}
  requireCheck(Number.isFinite(snapshot.metrics?.capitalSpending)&&Math.abs(snapshot.metrics.capitalSpending-capital)<1e-6,'Cumulative capital disagrees with monthly ledger');
  const events=snapshot.events??[];
  for(const building of state.buildings){
   if(seen.has(building.id))continue;
   const project=state.projects.find(row=>row.type==='housing'&&housingProjectBuildingId(row.id)===building.id);
   requireCheck(project?.stage==='completion','New inventory lacks completed housing project');
   const event=events.find(row=>row.eventType==='PROJECT_COMPLETE'&&row.payload?.projectId===project.id);
   requireCheck(event?.simulationTime===month&&event.modelVersion===MODEL_VERSION,'New inventory lacks contemporaneous completion event');
   const units=state.units.filter(unit=>unit.buildingId===building.id);
   requireCheck(units.length===project.units&&event.payload.units===project.units,'Completion units disagree with inventory');
   requireCheck(!project.policyId||state.policies.some(policy=>policy.id===project.policyId),'Completion policy identity unavailable');
   completions.push({month,eventId:event.id,projectId:project.id,policyId:project.policyId??null,buildingId:building.id,unitIds:units.map(unit=>unit.id)});
   seen.add(building.id);
  }
  for(const unit of state.units){
   if(seenUnits.has(unit.id))continue;
   requireCheck(completions.some(event=>event.month===month&&event.buildingId===unit.buildingId&&event.unitIds.includes(unit.id)),'New unit lacks contemporaneous housing completion');
   seenUnits.add(unit.id);
  }
 }
 return {inventoryReconciled:true,financeReconciled:true,completionReconciled:true,completions};
}

function checkedProtocol(input){
 const {seeds,delays}=input;
 requireCheck(Array.isArray(seeds)&&seeds.length>0&&seeds.length<=4&&new Set(seeds).size===seeds.length,'Use 1–4 unique seeds');
 requireCheck(Array.isArray(delays)&&delays.length>0&&delays.length<=3&&new Set(delays).size===delays.length,'Use 1–3 unique delays');
 for(const seed of seeds)validateRecipe({...DEFAULT_RECIPE,seed});
 requireCheck(delays.every(delay=>Number.isInteger(delay)&&delay>=0&&delay<=120),'Delay must be an integer from 0 through 120');
 return {seeds:[...seeds],delays:[...delays],households:DEFAULT_RECIPE.households,months:MONTHS,repeatedInterventions:true,executionScope:'engine only'};
}

/** Bounded engine experiment. No server, browser, persistence or new model rules. */
export async function runSensitivity(input=DEFAULT_PROTOCOL){
 const protocol=checkedProtocol(input),started=performance.now();let totalMonthlySteps=0;
 const cases=[],controls=[];
 function run(initial,intervention){
  const engine=createEngine(),steps=[];let state=intervention?addIntervention(initial,intervention):structuredClone(initial);
  for(let month=0;month<MONTHS;month++){const step=engine.step(state);steps.push(step);state=step.state;totalMonthlySteps++;}
  return normalizeReplay(initial,{steps});
 }
 for(const seed of protocol.seeds){
  const original=freeze(initialForRecipe({...DEFAULT_RECIPE,seed})),initialHash=await stateHash(original);
  let baseline,baselineHash,zeroHash;
  try{
   baseline=run(original,null);baselineHash=await stateHash(baseline);
   const zero=run(original,null);zeroHash=await stateHash(zero);
   requireCheck(zeroHash===baselineHash,'Independent zero control differs from baseline');
   const zeroChecks=reconcileHistory(zero,original);reconcileHistory(baseline,original);
   requireCheck(await stateHash(original)===initialHash,'Original mutated during zero control');
   controls.push({seed,recipe:{...DEFAULT_RECIPE,seed,intervention:null},initialHash,baselineHistoryHash:baselineHash,zeroControlHistoryHash:zeroHash,checks:{zeroControlEqual:true,originalUnchanged:true,...zeroChecks},status:'passed',error:null});
  }catch(error){
   controls.push({seed,recipe:{...DEFAULT_RECIPE,seed,intervention:null},initialHash,status:error instanceof ResearchCheckError?'failed':'error',error:error.message});
   for(const delay of protocol.delays)cases.push({seed,delay,status:'error',error:'Baseline/control prerequisite failed'});
   continue;
  }
  for(const delay of protocol.delays){
   const recipe=validateRecipe({...DEFAULT_RECIPE,seed,intervention:{...DEFAULT_RECIPE.intervention,delay}});
   const result={seed,delay,recipe,initialHash,baselineHistoryHash:baselineHash,zeroControlHistoryHash:zeroHash,status:'error',error:null};
   try{
    const plan=run(original,recipe.intervention),planHash=await stateHash(plan);
    const repeatedHash=await stateHash(run(original,recipe.intervention));
    requireCheck(repeatedHash===planHash,'Repeated intervention history differs');
    requireCheck(await stateHash(original)===initialHash,'Original mutated during intervention');
    requireCheck(await stateHash(baseline[0])===await stateHash(plan[0]),'Month Zero differs between arms');
    const reconciled=reconcileHistory(plan,original);
    const months=[];
    for(let month=0;month<=MONTHS;month++){
     const diff=compareFrame({month,baseline:baseline[month],plan:plan[month]});
     const metrics=Object.fromEntries(metricKeys.map(key=>[key,diff.metrics[key]]));
     requireCheck(Object.values(metrics).every(metric=>metric.status==='available'&&[metric.baseline,metric.plan,metric.delta].every(Number.isFinite)),'Unavailable or nonfinite comparison');
     months.push({month,baselineStateHash:await stateHash(baseline[month].state),planStateHash:await stateHash(plan[month].state),metrics,completionEvents:reconciled.completions.filter(event=>event.month===month)});
    }
    Object.assign(result,{planHistoryHash:planHash,repeatedHistoryHash:repeatedHash,months,checks:{originalUnchanged:true,matchedMonthZero:true,zeroControlEqual:true,deterministicRepeat:true,inventoryReconciled:true,financeReconciled:true,completionReconciled:true},status:'passed'});
   }catch(error){result.status=error instanceof ResearchCheckError?'failed':'error';result.error=error.message;}
   cases.push(result);
  }
 }
 const source={modelVersion:MODEL_VERSION,modelManifest:createEngine().manifest,generatorVersion:'future-machine-synthetic.v1'};
 const limitations=[
  'Synthetic uncalibrated monthly City results, not empirical forecasts or confidence intervals.',
  'Private parcel capacity is zero, utility capacity is 200 per district/network, annual growth is zero.',
  'Seeds vary synthetic initial household income as well as later random draws; variation is not isolated stochastic uncertainty.',
  'Whole-stock mean rent includes newly added inventory; changes are not incumbent household savings.',
  'Engine-only timing excludes API workers, persistence, network and rendering.',
  'Recomputed histories are not independently retained observed checkpoints. Completion relationships do not establish real-world causality.'
 ];
 const status=controls.every(row=>row.status==='passed')&&cases.every(row=>row.status==='passed')?'passed':'failed';
 return {schemaVersion:'future-machine-sensitivity.v1',source,protocol,controls,cases,limitations,status,deterministicHash:await stateHash({protocol,controls,cases}),deterministicHashScope:'canonical JSON of {protocol,controls,cases}; excludes timing and source metadata',timing:{elapsedMs:performance.now()-started,totalMonthlySteps}};
}

async function captureSource(){
 const files=['scripts/research-future-sensitivity.mjs','world/city/contracts.js','world/city/seed.js','world/city/engine.js','world/city/systems.js','world/future-machine/contracts.js','world/future-machine/data/index.js','world/future-machine/data/core.js','world/future-machine/diff/index.js','world/future-machine/diff/core.js'];
 const hashes={};for(const path of files)hashes[path]=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
 const git=Bun.spawnSync(['git','rev-parse','HEAD'],{cwd:fileURLToPath(new URL('..',import.meta.url))});
 return {gitCommit:git.exitCode===0?git.stdout.toString().trim():null,contentHashes:hashes,hashEncoding:'SHA-256 of source file bytes'};
}
if(import.meta.main){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output')throw new Error('Usage: bun scripts/research-future-sensitivity.mjs --output /absolute/result.json');
 const source=await captureSource(),result=await runSensitivity(),after=await captureSource();Object.assign(result.source,source);
 result.source.unchangedDuringRun=JSON.stringify(source)===JSON.stringify(after);
 result.source.runtime={bun:Bun.version,platform:process.platform,architecture:process.arch};
 if(!result.source.unchangedDuringRun){result.status='failed';result.source.error='Source files or commit changed during execution';}
 await writeFile(args[1],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({output:args[1],status:result.status,cases:result.cases.length,deterministicHash:result.deterministicHash,...result.timing}));
 if(result.status!=='passed')process.exitCode=1;
}
