import {test,expect} from 'bun:test';
import {projectHouseholdEconomy,householdBudgetChange} from '../world/house/economic-adapter.js';
const fixture=()=>({employment:{schemaVersion:'business-employment.v1',period:1,wages:2000},mapping:{schemaVersion:'household-economic.v1',householdId:'household:test:1',businessId:'business:test:1',allocationFraction:.5,periodDays:10},housingCostPerDay:30,commuteCostPerDay:10,commuteMinutesPerDay:40,context:{universeId:'universe:test:1',scenarioId:'scenario:test:1',seed:1,modelVersion:'fixture.v1',worldId:'world:test:1',runId:'run:test:1',tick:0}});
test('deterministic payroll allocation and budget changes preserve source state',()=>{const input=fixture(),saved=structuredClone(input),a=projectHouseholdEconomy(input);expect(a.budget.disposablePerDay).toBe(60);expect(projectHouseholdEconomy(input)).toEqual(a);expect(input).toEqual(saved);const b=projectHouseholdEconomy({...input,employment:{...input.employment,wages:1000}});expect(householdBudgetChange(a,b)).toBe(-50);});
test('rejects missing context and invalid allocation',()=>{expect(()=>projectHouseholdEconomy({...fixture(),context:{}})).toThrow();const f=fixture();f.mapping.allocationFraction=2;expect(()=>projectHouseholdEconomy(f)).toThrow();});

test('connected payroll rejects cross-run attribution and emits valid evidence',async()=>{
 const {connectHouseholdEconomy}=await import('../world/house/economic-adapter.js');
 const {CausalSnapshotSchema}=await import('../shared/causality/index.js');
 const f=fixture();f.employment={...f.employment,entityId:f.mapping.businessId,context:f.context,provenance:{sourceIds:['observation:business:payroll']}};
 const result=connectHouseholdEconomy(f);
 expect(CausalSnapshotSchema.safeParse(result.snapshot).success).toBe(true);
 expect(result.snapshot.observations).toHaveLength(4);
 f.employment.context={...f.context,runId:'run:test:other'};
 expect(()=>connectHouseholdEconomy(f)).toThrow('context mismatch');
});

test('inspector links preserve exact tick and require explicit household mappings',async()=>{
 const {householdEconomicActions,resolveHouseholdEconomicLink}=await import('../world/house/economic-inspector.js');
 const p=projectHouseholdEconomy(fixture()),mappings=[{kind:'household',namespace:'test',localId:'1',canonicalId:p.householdId}];
 const actions=householdEconomicActions(p,{mappings,experimentLocalId:'abcdefgh'});
 expect(actions[1].href).toContain('/world/house/1?experiment=abcdefgh');
 expect(await resolveHouseholdEconomicLink(actions[0].href,{mappings,loadProjection:async()=>p})).toEqual(p);
 await expect(resolveHouseholdEconomicLink(actions[0].href,{mappings,loadProjection:async()=>({...p,context:{...p.context,tick:1}})})).rejects.toThrow('context mismatch');
 expect(()=>householdEconomicActions(p,{mappings:[],experimentLocalId:'abcdefgh'})).toThrow();
});

test('real business labor shock reduces household budget with matched deterministic seed',async()=>{
 const {createDefinition}=await import('../world/models/business-v1/content.js');
 const {approveDefinition,createBusinessState,defaultPlan}=await import('../world/models/business-v1/index.js');
 const {advanceConnectedBusiness}=await import('../world/models/business-v1/external-adapter.js');
 const {connectHouseholdEconomy}=await import('../world/house/economic-adapter.js');
 const f=fixture(),state=createBusinessState(approveDefinition(createDefinition('local-retail')),42),plan=defaultPlan(state.def);
 const advance=externalInputs=>advanceConnectedBusiness(state,plan,{context:f.context,entityId:f.mapping.businessId,externalInputs});
 const base=advance({}),shock=advance({availableWorkerHours:0});
 const household=result=>connectHouseholdEconomy({...f,context:result.employment.context,employment:result.employment}).projection;
 expect(householdBudgetChange(household(base),household(shock))).toBeLessThan(0);
 expect(household(advance({}))).toEqual(household(base));
 expect(state.period).toBe(0);
});
