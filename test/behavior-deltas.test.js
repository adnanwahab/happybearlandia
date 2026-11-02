import { expect, test } from 'bun:test';
import { compareBehaviorActors } from '../world/analysis/behavior-deltas.js';
const manifest = { modelVersion: '1.0.0', config: { seed: 42, snapshotId: 'fixture.v1', population: 1000 } };
const compare = (baseline,treatment,extra={}) => compareBehaviorActors({ baseline, treatment, baselineScenarioId: 'baseline', treatmentScenarioId: 'plan-a', baselineManifest: manifest, treatmentManifest: manifest, ...extra });
test('paired actor deltas report real weights, missing matches and distinct risk', () => {
  const baseline = [{id:'p1',weight:20,mode:'car',homeDistrictId:'a',displacementRisk:true},{id:'p2',weight:10,mode:'walk'},{id:'missing',weight:1}];
  const treatment = [{id:'p1',weight:20,mode:'rail',homeDistrictId:'b',displacementRisk:false},{id:'p2',weight:10,mode:'walk'},{id:'new',weight:1}];
  const result = compare(baseline,treatment);
  expect(result.summary).toMatchObject({ matched:2,changed:1,unchanged:1,unmatchedBaseline:1,unmatchedTreatment:1,matchedWeight:30,changedWeight:20 });
  expect(result.summary.weightedCounts).toMatchObject({modeChanged:20,housingChanged:20,displacementRiskChanged:20});
  expect(result.rows[0].changedFields).toContain('displacementRisk');
  expect(result.rows[0].changedDecisionTypes).not.toContain('displacement');
  expect(baseline[0].mode).toBe('car');
});
test('missing or unequal paired weights never become inferred citywide counts', () => {
  for (const weights of [[undefined,undefined],[1,2],[0,0]]) {
    const result=compare([{id:'p',mode:'car',weight:weights[0]}],[{id:'p',mode:'bus',weight:weights[1]}]);
    expect(result.summary.weightedCounts).toBeNull();
    expect(result.summary.matchedWeight).toBeNull();
    expect(result.summary.counts.modeChanged).toBe(1);
  }
});
test('seed, snapshot, population and version incompatibility rejects comparisons', () => {
  for (const changed of [{modelVersion:'2'}, {config:{...manifest.config,seed:43}}, {config:{...manifest.config,snapshotId:'other'}}, {config:{...manifest.config,population:999}}]) {
    expect(() => compare([],[],{treatmentManifest:{...manifest,...changed}})).toThrow();
  }
  expect(() => compare([{id:'duplicate'},{id:'duplicate'}],[])).toThrow();
  expect(() => compare([],[],{baselineManifest:{...manifest,config:{...manifest.config,householdSize:2}},treatmentManifest:{...manifest,config:{...manifest.config,householdSize:3}}})).toThrow();
});
