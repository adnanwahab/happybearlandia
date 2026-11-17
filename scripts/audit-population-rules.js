import {createHash} from 'node:crypto';
import os from 'node:os';
import {createPopulationModel,stepPopulation,serializePopulation} from '../world/population/model.js';
import {auditPopulation,distributionDrift,AUDIT_VERSION} from '../world/population/invariants.js';

const population=Number(process.argv[2]??1000);
if(!Number.isInteger(population)||population<1||population>1000) throw Error('Audit population must be an integer from 1 to 1000');
const scenarios=[{id:'baseline',values:{}},{id:'no-transit',values:{transitService:0}},{id:'no-employment',values:{employmentRate:0}},{id:'weighted',values:{representedPopulation:population*10,childcareCapacity:20000,summerCampCapacity:10000}}];
const worldContext={buildings:Array.from({length:30},(_,i)=>({id:`synthetic-b${i}`,center:[i*180,i%4*250],kind:i%2?'home':'work'}))};
const reports=[];
const started=performance.now();
for(const seed of [42,43]) for(const scenario of scenarios){
 const config={population,seed,...scenario.values};
 const model=createPopulationModel(config,worldContext), initial=auditPopulation(model);
 const failures=initial.failures.map(f=>({tick:0,...f}));
 const checkpoints=[];
 for(let tick=1;tick<=144;tick++){
  stepPopulation(model,{tick,minutes:30});
  const report=auditPopulation(model);
  failures.push(...report.failures.map(f=>({tick,...f})));
  if(tick%24===0) checkpoints.push(report);
 }
 const final=checkpoints.at(-1);
 reports.push({scenario:scenario.id,config:model.config,initial,checkpoints,failures,
  stateHash:createHash('sha256').update(JSON.stringify(serializePopulation(model))).digest('hex'),
  drift:Object.fromEntries(Object.keys(initial.distributions).map(key=>[key,distributionDrift(initial.distributions[key],final.distributions[key])]))});
}
const baselineBySeed=new Map(reports.filter(r=>r.scenario==='baseline').map(r=>[r.config.seed,r]));
for(const report of reports){const baseline=baselineBySeed.get(report.config.seed).checkpoints.at(-1);report.seedMatchedDrift=Object.fromEntries(Object.keys(baseline.distributions).map(key=>[key,distributionDrift(baseline.distributions[key],report.checkpoints.at(-1).distributions[key])]));}
console.log(JSON.stringify({schemaVersion:AUDIT_VERSION,generatedAt:new Date().toISOString(),
 machine:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,memoryBytes:os.totalmem(),runtime:process.version,bun:Bun.version},
 worldContext,geographySource:'synthetic grid; not observed map coordinates',
 window:{stepMinutes:30,steps:144,elapsedModelMinutes:4320},wallSeconds:(performance.now()-started)/1000,
 passed:reports.every(r=>!r.failures.length),reports,
 limitations:['Synthetic assumptions only; no observational calibration or external data.',
 'Drift is descriptive total variation distance, not an empirical acceptance threshold or an effect estimate.',
 'Activity/mode histograms are end-state stocks; trip counters are cumulative flows; income bins count households.',
 'Service access is a bounded synthetic district score; no conserved service-demand ledger exists.',
 'Population 1.3.0 only; scalar oracle, City, Decision Studio and GPU equivalence unverified.',
 'Three modeled days, two seeds, at most 1000 records; no sustained or million-agent scaling claim.']},null,2));
if(reports.some(r=>r.failures.length)) process.exitCode=1;
