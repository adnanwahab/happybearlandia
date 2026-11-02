import { describe, test, expect } from 'bun:test';
import { createDefinition, ARCHETYPES } from '../world/models/business-v1/content.js';
import { approveDefinition, validateDefinition, copy } from '../world/models/business-v1/schema.js';
import { compileLocal, proposeLocalEdit } from '../world/models/business-v1/compiler.js';
import { createBusinessState, defaultPlan, simulatePeriod, forecast, financeAction } from '../world/models/business-v1/index.js';
import { runFutures, replayFuture, simulateBusinessRun, suggestedPlan } from '../world/models/business-v1/futures.js';
import { createBusinessCompilerHandler } from '../world/models/business-v1/compiler-api.js';
const setup = (archetype = 'local-retail', overrides = {}) => {
  const def = approveDefinition(createDefinition(archetype, overrides));
  return { def, state:createBusinessState(def,42), plan:defaultPlan(def) };
};

describe('Business definition and compiler', () => {
  test('nothing runs before approval; approved values are frozen', () => {
    const draft = createDefinition(); expect(()=>createBusinessState(draft)).toThrow('approve');
    const def = approveDefinition(draft); expect(Object.isFrozen(def.segments)).toBe(true);
    draft.price = 100; expect(def.price).toBe(2);
  });
  test('yuzu and curated scenarios share a validated definition', () => {
    const draft = compileLocal('A sparkling yuzu drink for gamers in 12-packs for $28.');
    expect(draft.def.archetype).toBe('physical-product'); expect(draft.def.price).toBe(28); expect(draft.def.unitCost).toBe(10.4);
    expect(draft.provenance.price).toBe('player-set'); expect(validateDefinition(draft.def).valid).toBe(true);
    for(const id of Object.keys(ARCHETYPES)) expect(validateDefinition(createDefinition(id)).valid).toBe(true);
  });
  test('rejects impossible values and stages edits without mutating the company', () => {
    const {def}=setup();const before=copy(def), proposal=proposeLocalEdit('Raise price to $3 and quality to 85',def);
    expect(proposal.def.price).toBe(3);expect(proposal.def.approved).toBeUndefined();expect(def).toEqual(before);
    expect(validateDefinition({...copy(def),capacity:0}).valid).toBe(false);
    expect(validateDefinition({...copy(def),unitCost:5}).valid).toBe(false);
    expect(()=>proposeLocalEdit('Raise price to $3 and launch a new SKU',def)).toThrow();
  });
});
describe('Pure business period engine',()=>{
  test('reproducible replay, forecast-before-plan, no input mutation',()=>{
    const {state,plan}=setup(), before=copy(state);
    const a=simulatePeriod(state,plan),b=simulatePeriod(state,plan);
    expect(a).toEqual(b); expect(state).toEqual(before);
    expect(a.report.forecast).toEqual(forecast(state,1)[0]);
    expect(a.trace.length).toBe(a.report.arrivals);
    expect(Object.values(a.report.outcomes).reduce((x,y)=>x+y,0)).toBe(a.report.arrivals);
    expect(a.report.outcomes.bought).toBeGreaterThan(0);
  });
  test('inventory and money reconcile without double charging purchases',()=>{
    const {state,plan}=setup();const {report:r,state:s}=simulatePeriod(state,plan);
    expect(s.cash).toBeCloseTo(state.cash+r.revenue-r.inputCash-r.rent-r.wages-r.marketingCost-r.interest-r.equipmentPurchase-r.tierCost,8);
    expect(r.profit).toBeCloseTo(r.revenue-r.cogs-r.spoilageCost-r.rent-r.wages-r.marketingCost-r.interest,8);
    expect(s.inventoryValue+r.cogs+r.spoilageCost).toBeCloseTo(r.inputCash,8);
    expect(s.inventory).toBeGreaterThanOrEqual(0);
  });
  test('stockouts and customer budgets have explicit reasons',()=>{
    const {state,plan}=setup();const empty=simulatePeriod(state,{...plan,production:0});
    expect(empty.report.outcomes['sold out']).toBeGreaterThan(0);expect(empty.report.outcomes.bought).toBe(0);
    const expensive=simulatePeriod(state,{...plan,price:999});expect(expensive.report.outcomes['too expensive']).toBe(expensive.report.arrivals);
  });
  test('lead-time orders arrive only when due and financing keeps its ledger',()=>{
    const {state,plan}=setup('physical-product',{leadTime:2});const first=simulatePeriod(state,plan);
    expect(first.report.outcomes.bought).toBe(0);expect(first.state.pipeline.length).toBeGreaterThan(0);
    const second=simulatePeriod(first.state,{...plan,production:0});expect(second.report.outcomes.bought).toBe(0);
    const third=simulatePeriod(second.state,{...plan,production:0});expect(third.report.outcomes.bought).toBeGreaterThan(0);
    const loan=financeAction(state,'loan',1000);expect(loan.cash-state.cash).toBe(1000);expect(loan.debt).toBe(1000);expect(state.debt).toBe(0);
    expect(()=>financeAction(state,'equity',1000)).toThrow();
    const eligible={...state,period:2,totalRevenue:50000};
    const funded=financeAction(eligible,'equity',1000);
    expect(funded.ownership).toBeLessThan(1);expect(funded.cash-eligible.cash).toBe(1000);
    expect(()=>financeAction(funded,'equity',1000)).toThrow('one investor round');
  });
  test('all archetypes produce finite metrics and subscriptions retain customers',()=>{
    for(const id of Object.keys(ARCHETYPES)){
      const {state,plan}=setup(id);const result=simulatePeriod(state,plan);
      expect(Number.isFinite(result.report.profit)).toBe(true);expect(Number.isFinite(result.state.cash)).toBe(true);
    }
    const {state,plan}=setup('subscription');state.customers=80;const {report,state:s}=simulatePeriod(state,plan);
    expect(report.churned).toBeGreaterThan(0);expect(report.mrr).toBe(s.customers*plan.price);expect(report.cogs).toBeGreaterThan(0);
  });
  test('bankruptcy is three consecutive negative days or one negative month',()=>{
    for(const id of ['local-retail','physical-product']){
      const {state,plan}=setup(id,{startingCash:0});const noSales={...plan,price:1e6,production:0};
      const a=simulatePeriod(state,noSales);expect(a.state.bankrupt).toBe(id==='physical-product');
      if(id==='local-retail'){const b=simulatePeriod(a.state,noSales),c=simulatePeriod(b.state,noSales);expect(c.state.bankrupt).toBe(true);expect(()=>simulatePeriod(c.state,noSales)).toThrow('bankrupt');}
    }
  });
  test('invalid levers cannot poison accounting',()=>{
    const {state,plan}=setup();for(const bad of [{staff:NaN},{equipment:-1},{production:Infinity},{price:0}])expect(()=>simulatePeriod(state,{...plan,...bad})).toThrow();
  });
});
describe('Shared HBL futures runner',()=>{
  test('same-seed paired plans are identical; future replays match the dot',async()=>{
    const {state,plan}=setup();const result=await runFutures(state,plan,{count:8,horizon:4,alternatives:[plan]});
    expect(result.summaries[0].count).toBe(8);expect(Object.values(result.summaries[0].buckets).reduce((a,b)=>a+b,0)).toBe(8);
    const a=result.summaries[0].runs,b=result.summaries[1].runs;
    for(let i=0;i<a.length;i++){expect(a[i].seed).toBe(b[i].seed);expect(a[i].metrics).toEqual(b[i].metrics);}
    expect(replayFuture(result,0).reports[0].forecast).toEqual(forecast(state,1)[0]);
    expect(replayFuture(result,0).metrics).toEqual(a[0].metrics);expect(state.period).toBe(0);
  });
  test('suggestions change a lever and paired alternatives produce different accounts',async()=>{
    const {state,plan}=setup();const suggestion=suggestedPlan(plan,{causes:[{cause:'Payroll above 50% of sales'}]});
    expect(suggestion.plan).not.toEqual(plan);
    const result=await runFutures(state,plan,{count:2,horizon:2,alternatives:[{...plan,staff:2}]});
    expect(result.summaries[0].runs[0].seed).toBe(result.summaries[1].runs[0].seed);
    expect(result.summaries[0].runs[0].metrics.cash).not.toBe(result.summaries[1].runs[0].metrics.cash);
  });
  test('500 actual futures complete and do not mutate the starting company',async()=>{
    const {state,plan}=setup();const result=await runFutures(state,plan,{count:500,horizon:3});
    expect(result.summaries[0].count).toBe(500);expect(result.summaries[0].failed).toBe(0);expect(state.period).toBe(0);
  });
});
describe('Compiler API',()=>{
  const req=body=>new Request('http://localhost/api/business/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  test('local proposals are unapproved and unavailable providers fail clearly',async()=>{
    const handle=createBusinessCompilerHandler({env:{}});const response=await handle(req({text:'lemonade for $2',provider:'demo'}));
    expect(response.status).toBe(200);const result=await response.json();expect(result.def.approved).toBeUndefined();
    expect((await handle(req({text:'lemonade',provider:'openai'}))).status).toBe(400);
  });
  test('AI output is validated and repaired; credentials stay server-side',async()=>{
    let calls=0;const handle=createBusinessCompilerHandler({env:{OPENAI_API_KEY:'test-secret',OPENAI_MODEL:'test-model'},fetchImpl:async()=>{calls++;const def=createDefinition();if(calls===1)def.capacity=0;return Response.json({status:'completed',output_text:JSON.stringify({definitionJson:JSON.stringify(def),warnings:[]})});}});
    const response=await handle(req({text:'lemonade',provider:'openai'}));expect(response.status).toBe(200);expect(calls).toBe(2);expect(JSON.stringify(await response.json())).not.toContain('test-secret');
  });
});
