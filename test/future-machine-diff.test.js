import {describe, expect, test} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {addIntervention, cityMetrics, createEngine} from '../world/city/engine.js';
import {DEFAULT_RECIPE, METRIC_UNITS} from '../world/future-machine/contracts.js';
import {initialForRecipe, normalizeReplay} from '../world/future-machine/data/index.js';
import {compareFrame, compareHistory, metricDelta} from '../world/future-machine/diff/index.js';

function snapshot(state, capitalSpending = 0) {
  return {month:state.month, state, metrics:{...cityMetrics(state),capitalSpending}, events:[],causalRecords:[],decisions:[]};
}
function frame(a = createCity({households:6}), b = structuredClone(a)) {
  return {month:a.month, baseline:snapshot(a), plan:snapshot(b)};
}
function history(intervention = null) {
  const engine = createEngine(), city = createCity({households:6});
  // Explicit synthetic headroom lets this fixture exercise completed housing.
  // Both futures receive exactly the same capacity assumptions before the fork.
  for (const utility of city.utilities) utility.capacity = 100;
  const initial = engine.initialize(city);
  function run(policy) {
    let state = policy ? addIntervention(initial,policy) : initial, spent = 0;
    const snapshots = [snapshot(initial)];
    for (let i=0;i<120;i++) { state = engine.step(state).state; spent += state.systems.finance.capitalExpense; snapshots.push(snapshot(state,spent)); }
    return snapshots;
  }
  return {schemaVersion:'future-machine.v1',seed:initial.seed,modelVersion:initial.version,initialHash:'fixture-common-original',baseline:run(null),plan:run(intervention)};
}

describe('Future Machine stable-ID diff', () => {
  test('zero differences ignore array and object insertion order and preserve inputs', () => {
    const pair = frame(), before = structuredClone(pair);
    pair.plan.state.units.reverse(); pair.plan.state.households.reverse();
    pair.plan.state.buildings = pair.plan.state.buildings.map(b => Object.fromEntries(Object.entries(b).reverse()));
    const diff = compareFrame(pair);
    expect(diff.available).toBe(true); expect(diff.entities).toEqual([]); expect(diff.physicalCount).toBe(0);
    expect(Object.values(diff.metrics).every(m => m.delta === 0)).toBe(true);
    expect(pair.baseline).toEqual(before.baseline);
    expect(compareFrame(pair)).toEqual(diff);
  });

  test('reports stable-ID additions and removals in both directions without array matches', () => {
    const pair = frame();
    const removed = pair.plan.state.buildings.shift();
    pair.plan.state.buildings.push({id:'new-building',districtId:'d1',floors:3});
    const diff = compareFrame(pair), buildings = diff.entities.filter(e => e.collection === 'buildings');
    expect(buildings.map(e => [e.id,e.kind])).toEqual([[removed.id,'removed'],['new-building','added']]);
    expect(buildings[0].before).toEqual(removed); expect(buildings[0].after).toBeNull();
    expect(diff.physicalCount).toBe(2);
    const reverse = compareFrame({...pair,baseline:pair.plan,plan:pair.baseline});
    expect(reverse.entities.find(e => e.id === 'new-building').kind).toBe('removed');
  });

  test('physical records distinguish floors from policies, zoning, rent and savings', () => {
    const pair = frame();
    pair.plan.state.buildings[0].floors++;
    pair.plan.state.parcels[0].capacity++;
    pair.plan.state.units[0].rent += 20;
    pair.plan.state.households[0].savings += 500;
    pair.plan.state.policies.push({id:'policy-new',type:'housing'});
    pair.plan.state.provenance.worldRevision = 'revision-test';
    const diff = compareFrame(pair);
    expect(diff.physicalCount).toBe(1); expect(diff.changedCount).toBe(5);
    expect(diff.entities.find(e => e.collection === 'buildings').changedFields).toEqual(['floors']);
    expect(diff.entities.filter(e => e.collection !== 'buildings').every(e => !e.physical)).toBe(true);
    const h = diff.households.rows.find(h => h.id === pair.baseline.state.households[0].id);
    expect(h.savings.delta).toBe(500); expect(h.rent.delta).toBe(20);
    expect(h.housing.plan.buildingId).toBe(pair.plan.state.units[0].buildingId);
    expect(diff.households.identityAuthority).toBe('monthly-city');
  });

  test('missing snapshots, collections and measurements are unavailable, not zero or removals', () => {
    const pair = frame();
    delete pair.plan.metrics.meanRent; pair.plan.metrics.balance = NaN;
    delete pair.plan.state.buildings;
    const diff = compareFrame(pair);
    expect(diff.available).toBe(false); expect(diff.metrics.meanRent.delta).toBeNull();
    expect(diff.metrics.balance.plan).toBeNull(); expect(diff.physicalCount).toBe(0);
    expect(diff.missing).toContainEqual({kind:'buildings',sides:['plan']});
    const absent = compareFrame({...pair,plan:null});
    expect(absent.available).toBe(false); expect(absent.entities).toEqual([]);
    expect(absent.metrics.housingUnits.delta).toBeNull();
    expect(metricDelta(0,0,'homes').delta).toBe(0);
    expect(metricDelta(Infinity,5,'homes').delta).toBeNull();
    expect(metricDelta(-1e308,1e308,'homes').delta).toBeNull();
  });

  test('missing physical attributes do not become building changes and field deletion is explicit', () => {
    const pair = frame();
    delete pair.plan.state.buildings[0].floors;
    const diff = compareFrame(pair), building = diff.entities.find(e => e.collection === 'buildings');
    expect(building.changedFields).toEqual(['floors']); expect(building.physical).toBe(false);
    expect(diff.physicalCount).toBe(0);
  });

  test('snapshot metrics own cumulative spending and carry contract units', () => {
    const pair = frame();
    pair.baseline.metrics.capitalSpending = 100; pair.plan.metrics.capitalSpending = 350;
    pair.plan.state.finance.capitalExpense = 99999;
    const diff = compareFrame(pair);
    expect(diff.metrics.capitalSpending).toMatchObject({baseline:100,plan:350,delta:250,unit:'USD cumulative'});
    expect(diff.metrics.meanTravelMinutes.unit).toBe('minutes/link');
    expect(diff.metrics.balance.unit).toBe('USD');
  });

  test('household presence is exact City inventory, with unknown housing left unlocated', () => {
    const pair = frame();
    const old = pair.plan.state.households.shift();
    pair.plan.state.households.push({...old,id:'new-household',unitId:'unknown-unit'});
    const diff = compareFrame(pair), rows = diff.households.rows;
    expect(rows.find(h => h.id === old.id).status).toBe('baseline-only');
    const added = rows.find(h => h.id === 'new-household');
    expect(added.status).toBe('plan-only'); expect(added.rent.delta).toBeNull();
    expect(added.housing.plan.buildingId).toBeNull();
    expect(diff.physicalCount).toBe(0);
  });

  test('rejects duplicate/missing IDs and mismatched clocks, seeds and model versions', () => {
    for (const mutate of [p => p.plan.state.buildings.push(p.plan.state.buildings[0]), p => delete p.plan.state.units[0].id,
      p => p.plan.state.seed++, p => p.plan.state.version = 'other', p => p.plan.state.month++]) {
      const pair = frame(); mutate(pair); expect(() => compareFrame(pair)).toThrow();
    }
    for (const month of [-1,121,0.5]) expect(() => compareFrame({month,baseline:null,plan:null})).toThrow();
  });

  test('real matched 120-step engine histories preserve Month 0/120 and deterministic zero/nonzero results', () => {
    const zero = history(), zeroDiffs = compareHistory(zero);
    expect(zeroDiffs).toHaveLength(121);
    expect(zeroDiffs.every(d => d.available && !d.changedCount && !d.physicalCount)).toBe(true);
    const policy = {type:'housing',districtId:'d1',amount:4,cost:100000,delay:0,compliance:1};
    const a = history(policy), b = history(policy), before = structuredClone(a);
    const diffs = compareHistory(a);
    expect(diffs[0].changedCount).toBe(0); expect(diffs[120].month).toBe(120);
    expect(diffs.some(d => d.physicalCount > 0)).toBe(true);
    expect(diffs[120].metrics.capitalSpending.delta).not.toBe(0);
    expect(compareHistory(b)).toEqual(diffs); expect(a).toEqual(before);
    // History row order cannot change month identity.
    expect(compareHistory({...a,baseline:[...a.baseline].reverse()})).toEqual(diffs);
  });

  test('sparse histories retain 121 explicit months and reject invalid initial or run metadata', () => {
    const initial = createCity({households:3});
    const sparse = {seed:initial.seed,modelVersion:initial.version,baseline:[snapshot(initial)],plan:[snapshot(structuredClone(initial))]};
    expect(compareHistory(sparse)[120].available).toBe(false);
    expect(compareHistory(sparse)[0].changedCount).toBe(0);
    const bad = structuredClone(sparse); bad.plan[0].state.parameters.labor++;
    expect(() => compareHistory(bad)).toThrow('common initial');
    expect(() => compareHistory({...sparse,seed:123})).toThrow('seed/model');
    expect(() => compareHistory({...sparse,baseline:[...sparse.baseline,...sparse.baseline]})).toThrow('Duplicate history');
  });
});


test('flagship seed 42 first physical difference is Month 16 with 24 homes, not 24 buildings', () => {
  const initial = initialForRecipe();
  function run(intervention) {
    let state = intervention ? addIntervention(initial, intervention) : structuredClone(initial);
    const engine = createEngine(), steps = [];
    for (let month = 1; month <= 120; month++) { const step = engine.step(state); steps.push(step); state = step.state; }
    return normalizeReplay(initial, {steps});
  }
  const pair = {seed:42,modelVersion:initial.version,baseline:run(null),plan:run(DEFAULT_RECIPE.intervention)};
  const diffs = compareHistory(pair);
  expect(diffs.slice(0,16).every(diff => diff.physicalCount === 0)).toBe(true);
  expect(diffs[16].physicalCount).toBe(1);
  const building = diffs[16].entities.find(entity => entity.physical);
  expect(building).toMatchObject({collection:'buildings',id:'building-project-policy-1-0',kind:'added',
    before:null,after:{floors:3,parcelId:null,districtId:'d1'}});
  const newUnits = diffs[16].entities.filter(entity => entity.collection === 'units' && entity.kind === 'added');
  expect(newUnits).toHaveLength(24);
  expect(newUnits.every(unit => unit.after.buildingId === building.id)).toBe(true);
  for (const month of [16,120]) {
    expect(diffs[month].metrics.housingUnits).toMatchObject({baseline:36,plan:60,delta:24,unit:'homes'});
    expect(diffs[month].metrics.capitalSpending).toMatchObject({baseline:0,plan:1000000,delta:1000000});
  }
  expect(diffs[16].metrics.meanTravelMinutes.delta).toBe(0);
  expect(diffs[120].metrics.meanTravelMinutes.delta).toBeCloseTo(-0.00025240888888866664,12);
  expect(diffs[120].metrics.meanRent.delta).toBeCloseTo(-740.7690092390735,9);
  expect(Object.fromEntries(Object.entries(diffs[120].metrics).map(([key,value]) => [key,value.unit]))).toEqual(METRIC_UNITS);
  const replayed = compareHistory({...pair,baseline:run(null),plan:run(DEFAULT_RECIPE.intervention)});
  expect(replayed).toEqual(diffs);
});
