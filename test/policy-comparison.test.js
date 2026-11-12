import {test,expect} from 'bun:test';
import {housingDrainageExperiment,POLICY_COMPARISON_VERSION} from '../world/city/policy-comparison.js';
import {normalizeExperiment} from '../world/city/api.js';
import {createEngine,addIntervention,cityMetrics} from '../world/city/engine.js';

test('guided recipes are funded, complete before the flood, and preserve matched replay inputs',()=>{
  const recipe=housingDrainageExperiment(),original=structuredClone(recipe);
  const manifest=normalizeExperiment(recipe),engine=createEngine();
  expect(manifest.initial.provenance.guidedComparison.recipeVersion).toBe(POLICY_COMPARISON_VERSION);
  for(let index=0;index<manifest.runs;index++){
    const results={};
    for(const scenario of manifest.scenarios){
      let initial=structuredClone(manifest.initial);initial.seed+=index;
      for(const intervention of scenario.interventions)initial=addIntervention(initial,intervention);
      const result=engine.run(initial,manifest.months);results[scenario.id]=result;
      // Compare independently regenerated monthly evidence, not just final metrics.
      expect(engine.run(initial,manifest.months)).toEqual(result);
      const floods=result.steps.flatMap(s=>s.events).filter(e=>e.eventType==='FLOOD_DAMAGE');
      expect(floods).toHaveLength(1);expect(floods[0].simulationTime).toBe(24);
      if(scenario.id!=='baseline'){
        const project=result.state.projects.find(p=>p.policyId);
        expect(project.stage).toBe('completion');
        const completion=result.steps.find(s=>s.events.some(e=>e.eventType==='PROJECT_COMPLETE'&&e.payload.projectId===project.id));
        expect(completion.state.month).toBeLessThan(24);
        expect(result.steps.reduce((sum,s)=>sum+s.state.systems.finance.capitalExpense,0)).toBe(scenario.interventions[0].cost);
      }
    }
    expect(cityMetrics(results.housing.state).housingUnits-cityMetrics(results.baseline.state).housingUnits).toBe(6);
    const damage=r=>r.steps.flatMap(s=>s.events).find(e=>e.eventType==='FLOOD_DAMAGE').payload.damage;
    expect(damage(results.drainage)).toBeLessThan(damage(results.baseline));
    expect(results.baseline.state.policies).toEqual([]);
  }
  expect(recipe).toEqual(original);
});

test('each guided invocation has isolated mutable inventory',()=>{
  const a=housingDrainageExperiment(),b=housingDrainageExperiment();
  a.initial.finance.balance=0;a.scenarios[1].interventions[0].amount=100;
  expect(b.initial.finance.balance).toBeGreaterThan(0);
  expect(b.scenarios[1].interventions[0].amount).toBe(6);
});

test('normal API persists all guided arms, flood evidence and replay provenance',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {CityStore}=await import('../world/city/storage.js');
  const {createCityApi}=await import('../world/city/api.js');
  const {POLICY_FLOOD_QUERY}=await import('../world/city/policy-comparison.js');
  const root=mkdtempSync(join(tmpdir(),'hbl-policy-')),store=new CityStore(root),handle=createCityApi({store});
  const call=async(path,body)=>{
    const response=await handle(new Request('http://localhost'+path,body===undefined?{}:{method:'POST',body:JSON.stringify(body)}));
    expect(response.ok).toBe(true);return response.json();
  };
  try{
    const {id}=await call('/api/city-experiments',housingDrainageExperiment());
    let record;
    for(let i=0;i<200;i++){
      record=await call('/api/city-experiments/'+id);
      if(!['queued','running'].includes(record.status))break;
      await new Promise(r=>setTimeout(r,20));
    }
    expect(record.status).toBe('complete');expect(record.completed).toBe(15);
    const base='/api/experiments/'+id;
    const {rows}=await call(base+'/query',{sql:POLICY_FLOOD_QUERY});
    expect(rows.map(r=>r.scenario_id)).toEqual(['baseline','drainage','housing']);
    for(const row of rows)expect(row.observed_flood_events).toBe(5);
    expect(rows[1].mean_damage_usd).toBeLessThan(rows[0].mean_damage_usd);
    const seeds=await call(base+'/query',{sql:'SELECT scenario_id, MIN(seed) AS first, MAX(seed) AS last FROM runs GROUP BY scenario_id'});
    for(const row of seeds.rows){expect(row.first).toBe(42);expect(row.last).toBe(46);}
    const lineage=await call(base+'/lineage');
    expect(lineage.provenance.guidedComparison.recipeVersion).toBe(POLICY_COMPARISON_VERSION);
    const replay=await call(base+'/replay',{scenarioId:'drainage',runIndex:4});
    const stored=await call(base+'/query',{sql:"SELECT metric_id, value FROM run_metrics WHERE run_id = 'drainage-4'"});
    for(const row of stored.rows)expect(replay.metrics[row.metric_id]).toBe(row.value);
    expect(replay.steps[23].events.some(e=>e.eventType==='FLOOD_DAMAGE')).toBe(true);
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
},15000);
