import { test, expect } from 'bun:test';
import { createDefinition } from '../world/models/business-v1/content.js';
import { approveDefinition } from '../world/models/business-v1/schema.js';
import { createBusinessState, defaultPlan, simulatePeriod } from '../world/models/business-v1/index.js';
test('external supply and labor change real accounts without mutating inputs', () => {
 const state = createBusinessState(approveDefinition(createDefinition('local-retail')),42), plan = defaultPlan(state.def);
 const base = simulatePeriod(state,plan);
 const closed = simulatePeriod(state,plan,{externalInputs:{availableWorkerHours:0,deliveredSupplyFraction:0,customerDemandMultiplier:0}});
 expect(closed.report.revenue).toBe(0); expect(closed.report.wages).toBe(0); expect(closed.report.operatingHours).toBe(0); expect(closed.report.inputCash).toBe(0);
 expect(base.report.wages).toBeGreaterThan(0); expect(state.period).toBe(0);
 expect(()=>simulatePeriod(state,plan,{externalInputs:{deliveredSupplyFraction:2}})).toThrow();
});
test('delivery delay postpones paid inventory',()=>{
 const state=createBusinessState(approveDefinition(createDefinition('local-retail')),42),plan=defaultPlan(state.def);
 const result=simulatePeriod(state,plan,{externalInputs:{deliveryDelayDays:5,deliveredSupplyFraction:.5}});
 expect(result.state.pipeline.length).toBeGreaterThan(0); expect(result.state.pipeline[0].due).toBeGreaterThan(result.state.period); expect(result.report.inventory).toBe(0);
});

test('connected transition emits validated synthetic observations', async()=>{
 const { advanceConnectedBusiness } = await import('../world/models/business-v1/external-adapter.js');
 const { CausalSnapshotSchema } = await import('../shared/causality/index.js');
 const state=createBusinessState(approveDefinition(createDefinition('local-retail')),42);
 const result=advanceConnectedBusiness(state,defaultPlan(state.def),{context:{universeId:'universe:test:1',worldId:'world:test:1',scenarioId:'scenario:test:1',runId:'run:test:1',seed:42,modelVersion:'1.0.0',tick:0},entityId:'business:test:1',sourceIds:['observation:logistics:1']});
 expect(CausalSnapshotSchema.safeParse(result.snapshot).success).toBe(true);
 expect(result.snapshot.edges.length).toBe(4);
 expect(result.snapshot.observations.every(row => row.sequence === result.state.period)).toBe(true);
});
