import {test,expect} from 'bun:test';
import {LAW_CATALOG,getLaw,LAW_LEVER_TYPES} from '../world/laws/catalog.js';
import {lawMechanismContract,realityMechanismContract} from '../world/laws/lever-contract.js';
import {compareLaw} from '../world/laws/comparison.js';
import {compileRealityProposal} from '../world/reality/compiler.js';
import {REALITY_MECHANISMS} from '../world/reality/registry.js';
test('reviewed laws declare exact levers, legal-model facets, actual consumers/state paths, measured outcome definitions and visibility limits',()=>{
 expect(LAW_LEVER_TYPES).toEqual(['time','money','eligibility','capacity','prices','rules','accessibility','risk']);
 for(const law of LAW_CATALOG.filter(row=>row.supported)){const contract=law.mechanismContract;expect(contract.schemaVersion).toBe('law-mechanism.v1');expect(contract.lawId).toBe(law.id);expect(contract.source.text).toBe(law.text);expect(contract.verification.status).toBe('execution-tested');expect(contract.budget.governmentFullyModeled).toBe(false);expect(contract.levers.length).toBeGreaterThan(0);expect(contract.unsupported).toEqual([]);expect(contract.chain.map(row=>row.kind)).toEqual(['law','eligibility-obligation-incentive-budget-constraint','institution-business','household-person','state-change','visible-change','measured-outcome']);
  for(const lever of contract.levers){expect(lever.types.every(type=>LAW_LEVER_TYPES.includes(type))).toBe(true);expect(lever.facets.length).toBeGreaterThan(0);expect(lever.parameter.value).not.toBeNull();expect(lever.consumer.file.startsWith('world/')).toBe(true);expect(lever.consumer.symbol.length).toBeGreaterThan(0);expect(lever.statePaths.length).toBeGreaterThan(0);expect(lever.outcomes.every(row=>row.value===null&&row.metricId&&row.unit)).toBe(true);expect(lever.visibility.recordedIdentityRequired).toBe(true);}
 }
});
test('unsupported employment laws remain unavailable; parameter existence alone is not an execution gate',async()=>{
 for(const number of[17,19,20,41,42,43,48,49]){const law=getLaw(number);expect(law.supported).toBe(false);expect(law.mechanismContract.levers).toEqual([]);expect(law.mechanismContract.status).toBe('mechanism-unavailable');expect(law.mechanismContract.unsupported.length).toBeGreaterThan(0);}
 const staged=lawMechanismContract({id:'law-17',number:17,text:'Automatic tax filing',mapping:{engine:'population',parameterPatch:{transitService:2}},limitations:[]});expect(staged.verification.status).toBe('requires-execution-check');
 const unknown=lawMechanismContract({id:'test',number:999,text:'Happiness +10',mapping:{engine:'population',parameterPatch:{happinessOffset:10}},limitations:[]});expect(unknown.status).toBe('mechanism-unavailable');expect(unknown.levers).toEqual([]);
 const result=await compareLaw({lawId:17});expect(result.mechanismTrace.execution.status).toBe('not-run');expect(result.mechanismTrace.measurements).toEqual([]);
});
test('law comparisons separate actual input application, queued authorization, numerical observations and source-ID visuals',async()=>{
 const population=await compareLaw({lawId:50,population:40,minutes:1440,worldContext:{districts:[{id:'local',x:0,z:0}]}}),trace=population.mechanismTrace;
 expect(trace.execution.status).toBe('completed');expect(trace.parameterEvidence[0]).toMatchObject({baseline:510,selected:555,status:'recorded-input',outcomeOffset:false});expect(trace.measurements.some(row=>row.metricId==='teenSleepMinutes'&&row.status==='measured-model-output')).toBe(true);for(const row of trace.measurements.filter(row=>row.status==='measured-model-output'))expect(row.delta).toBe(row.selected-row.baseline);expect(trace.visibleEvidence.recordedPersonIds).toEqual([]);
 const queued=await compareLaw({lawId:21,population:12,months:1});expect(queued.mechanismTrace.parameterEvidence[0].status).toBe('authorized-or-queued-input');expect(queued.mechanismTrace.parameterEvidence[0].selected.every(row=>row.stage!=='ACTIVE')).toBe(true);expect(queued.visual.recordedBuildingIds).toEqual([]);expect(queued.mechanismTrace.measurements.find(row=>row.metricId==='housingUnits').delta).toBe(0);
},15000);
test('Reality contracts bind the exact compiled values including zero fares and household fees, without treating templates as measured effects',()=>{
 for(const proposal of['Make housing affordable.','Make transit free.','Improve drainage.','Offer free summer camps.','Make childcare affordable.','Start school later for teens.']){const program=compileRealityProposal(proposal);expect(program.leverTypes.every(type=>LAW_LEVER_TYPES.includes(type))).toBe(true);for(const mechanism of program.mechanisms){expect(mechanism.mechanismContract.unsupported).toEqual([]);expect(mechanism.mechanismContract.levers.every(row=>row.parameter.status==='declared-input')).toBe(true);expect(mechanism.mechanismContract.chain.at(-1).status).toBe('requires-execution');}}
 const free=compileRealityProposal('Make transit free.').mechanisms[0].mechanismContract.levers[0];expect(free.parameter.path).toBe('config.transitFare');expect(free.parameter.value).toBe(0);expect(free.types).toContain('prices');
 const camp=compileRealityProposal('Offer free summer camps.').mechanisms[0].mechanismContract;expect(camp.levers.find(row=>row.parameter.key==='summerCampDailyCost').parameter.value).toBe(0);expect(camp.budget.status).toBe('fiscal-unavailable');
 for(const mechanism of REALITY_MECHANISMS)expect(realityMechanismContract(mechanism).unsupported).toEqual([]);
});
