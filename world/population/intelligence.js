import { populationParameters, validatePopulationConfig } from './contracts.js';
import { validatePopulationTargets, buildBehaviorModelCard, behaviorRangeWarnings } from './trust.js';
export function summarizePopulationIntelligence(snapshot = {}, baseline = null, {includeTrust=true} = {}) {
  const metrics = snapshot.metrics || {};
  const cohorts = (snapshot.cohorts || []).map(row => {
    const previous = baseline?.cohorts?.find(other => other.id === row.id);
    return {...row, comparison: previous ? Object.fromEntries(['meanIncome','meanBurden','meanUtility','count'].filter(key => Number.isFinite(row[key]) && Number.isFinite(previous[key])).map(key => [key,row[key]-previous[key]])) : null};
  });
  return {metrics, cohorts, metricChanges: baseline ? Object.fromEntries(Object.entries(metrics).filter(([key,value]) => Number.isFinite(value) && Number.isFinite(baseline.metrics?.[key])).map(([key,value])=>[key,value-baseline.metrics[key]])) : null, targets:includeTrust?validatePopulationTargets(snapshot):null, modelCard:includeTrust?buildBehaviorModelCard(snapshot):null, warnings:includeTrust?behaviorRangeWarnings(snapshot.config):null, provenance:snapshot.provenance || {}, comparisonNote:'Differences are actual aggregate outputs. Cohort membership can change; cohort means are not matched-person treatment effects. Visible agents are a render sample.'};
}
export function explainPopulationEntity(entity) {
  if (!entity) return {available:false, story:'Select a synthetic resident to inspect actual retained decisions.', decisions:[]};
  const decisions = Array.isArray(entity.decisionTrace) ? entity.decisionTrace : [];
  return {available:true, entityId:entity.id, synthetic:true, story:`Synthetic ${entity.id}: ${entity.employmentStatus || 'household'}; home ${entity.homeDistrictId ?? entity.homeDistrict ?? 'unavailable'}. ${decisions.length} retained decision records.`, decisions:structuredClone(decisions), currentAlternatives:entity.currentAlternatives || null, omissions:'Bounded retained trace only. Missing alternatives, probabilities, scores or earlier decisions are unavailable; inspect-only alternatives are not recorded choices.'};
}
export function proposePopulationImport(result, snapshot) {
  if (!result?.valid) throw new Error('Validate the aggregate dataset before proposing an import.');
  const {dataset,coverage,warnings} = result, suggestedConfig = {};
  const global = dataset.rows.find(row=>row.districtId==='__all__');
  if (dataset.kind==='population' && global) {
    for (const [field,param] of [['population','population'],['medianIncome','medianIncome'],['meanHouseholdSize','householdSize'],['employmentRate','employmentRate']]) if(global[field]!==undefined) suggestedConfig[param]=global[field];
    const checked=validatePopulationConfig({...snapshot.config,...suggestedConfig});
    if(!checked.valid) throw new Error('Imported global settings exceed supported model bounds; keep the dataset as reference or explicitly prepare a supported sample.');
  }
  return {schemaVersion:'population-data-import.v1',dataset,coverage,suggestedConfig,warnings:[...warnings,'Only explicit city population targets can propose global generation settings. District distributions, jobs, OD and transit remain reference data until a generation adapter is implemented. District medians are never averaged into a city median.'],requiresReset:true,applied:false};
}
export function runPopulationSensitivity(runtime, snapshot, {parameterIds=['rentMultiplier','transitService'], onProgress}={}) {
  if (!runtime?.runExperiments || !snapshot?.config) throw new Error('Runtime experiments and current config are required.');
  const sample=Math.min(1000,snapshot.config.population), baseline={...snapshot.config,population:sample,representedPopulation:sample};
  const configs=[baseline], levers=[];
  for(const id of parameterIds.slice(0,3)) {
    const parameter=populationParameters.find(row=>row.id===id); if(!parameter || !Number.isFinite(baseline[id]) || ['population','seed','representedPopulation'].includes(id)) throw new Error('Unsupported sensitivity lever.');
    let candidate=Math.min(parameter.max,baseline[id]+Math.max(Math.abs(baseline[id])*.1,(parameter.max-parameter.min)*.01));
    if(candidate===baseline[id]) candidate=Math.max(parameter.min,baseline[id]-(parameter.max-parameter.min)*.01);
    if(parameter.integer) candidate=Math.round(candidate);
    configs.push({...baseline,[id]:candidate}); levers.push({id,from:baseline[id],to:candidate});
  }
  const seed=snapshot.config.seed >>> 0;
  const job=runtime.runExperiments({configs,seeds:[seed,(seed+1)>>>0],runs:2,horizonDays:1,onProgress});
  return {...job,ready:job.ready.then(result=>({...result,diagnostic:{samplePopulation:sample,seeds:2,horizonDays:1,levers,note:'Actual independent runtime runs, with paired seeds. Diagnostic sample changes shared capacities/demand and is not a full-city elasticity, empirical uncertainty interval or calibration.'}}))};
}
