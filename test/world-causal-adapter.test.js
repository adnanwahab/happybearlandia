import {test,expect} from 'bun:test';
import {createWorldCausalScenario} from '../world/causal/scenario.js';
import {createEngine} from '../world/city/engine.js';
import {CausalSnapshotSchema,canonicalId} from '../shared/causality/index.js';
test('world-only scenario records five genuine mechanisms deterministically without changing seeded state',()=>{
 const a=createWorldCausalScenario(),b=createWorldCausalScenario();let plain=a.getState();const engine=createEngine();
 for(let i=0;i<20;i++){plain=engine.step(plain).state;a.step();b.step();expect(a.getState()).toEqual(plain);}
 expect(a.snapshot()).toEqual(b.snapshot());expect(CausalSnapshotSchema.safeParse(a.snapshot()).success).toBe(true);
 const snapshot=a.snapshot(),types=new Set(snapshot.events.map(e=>e.type));
 for(const type of ['POLICY_STAGE_CHANGED','PROJECT_COMPLETED','LINK_AVAILABILITY_CHANGED','EMPLOYMENT_MATCHED','HOUSEHOLD_RELOCATED'])expect(types.has(type)).toBe(true);
 const events=new Map(snapshot.events.map(e=>[e.id,e]));for(const edge of snapshot.edges){expect(events.get(edge.fromId).type).toBe('MODEL_INPUTS');expect(events.has(edge.toId)).toBe(true);expect(events.get(edge.toId).context.tick).toBe(edge.context.tick);}
 const road=snapshot.events.find(e=>e.type==='LINK_AVAILABILITY_CHANGED');expect(a.getEntities().find(m=>m.canonicalId===road.entityIds[0]).collection).toBe('links');
 const clone=a.getState();clone.seed=8;expect(a.getState().seed).toBe(2911);
});
test('strict mapped interventions reject stale, foreign, unknown parameters and do not change input state',async()=>{
 const a=createWorldCausalScenario(),context=a.getContext(),target=a.getEntities().find(m=>m.collection==='districts').canonicalId;
 const request={id:canonicalId('intervention','test','policy'),context,action:'city-policy',targetId:target,parameters:{type:'transit',amount:2,cost:0}};
 await a.intervene(request);expect(a.getState().policies).toHaveLength(2);
 expect(a.snapshot().events.at(-1).type).toBe('POLICY_PROPOSED');
 await expect(a.intervene({...request,parameters:{...request.parameters,outcome:100}})).rejects.toThrow();
 await expect(a.intervene({...request,targetId:canonicalId('district','foreign','d0')})).rejects.toThrow();
 a.step();await expect(a.intervene(request)).rejects.toThrow();
});
test('trace is opt-in and no graph is fabricated for a quiet transition',()=>{
 const a=createWorldCausalScenario(),s=a.getState();expect(createEngine().step(s).causalRecords).toBeUndefined();
 const first=a.step();expect(first.events.some(e=>e.type==='PROJECT_COMPLETED')).toBe(false);
 expect(first.edges.every(e=>e.provenance.kind==='simulated')).toBe(true);
});

test('scenario endpoint persists contract-valid dependencies once and rejects foreign writes',async()=>{
 const {Database}=await import('bun:sqlite'),{createCausalStore}=await import('../shared/causality/storage.js'),{createWorldCausalScenarioHandler}=await import('../world/causal/api.js');
 const db=new Database(':memory:');try{const store=createCausalStore(db),handle=createWorldCausalScenarioHandler({store});
 const request=()=>new Request('http://localhost/api/causality/world-scenario',{method:'POST'});
 const first=await handle(request());expect(first.status).toBe(200);const data=await first.json();expect(store.getRun(data.context.runId).status).toBe('completed');expect(store.getRun(data.context.runId).metadata.metricDefinitions).toEqual(createWorldCausalScenario().getMetrics());expect(store.getRun(data.context.runId).metadata.manifest).toEqual(createWorldCausalScenario().getManifest());expect(store.listCheckpoints(data.context.runId).items).toHaveLength(21);const monthly=store.listCheckpoints(data.context.runId).items.find(row=>row.context.tick===7);expect(monthly.state.state.month).toBe(7);expect(store.getNode(data.context.runId,data.targetId).type).toBe('PROJECT_COMPLETED');
 expect((await handle(new Request('http://localhost/api/causality/world-scenario',{method:'POST',body:'x'.repeat(1025)}))).status).toBe(413);
 expect((await handle(request())).status).toBe(200);expect(store.listRuns().items).toHaveLength(1);
 expect((await handle(new Request('http://localhost/api/causality/world-scenario',{method:'POST',headers:{origin:'https://foreign.test'}}))).status).toBe(403);
 }finally{db.close();}
});
