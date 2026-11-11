import {resolveHousingModel,runHousingCounterfactual} from '../../models/housing/index.js';
import {evaluateFactorial,createFactorialDesign} from './design.js';
export async function runHousingFactorial({run,scenario={},years,metricId,factors,seeds=[run?.seed],budget=128,distribution,signal,onProgress}={}) {
  createFactorialDesign({factors,seeds,budget,distribution});
  if(!run?.modelVersion||!run.sampledParameters||!Number.isInteger(years)||years<1||years>50) throw Error('Recorded version, effective sampledParameters and explicit 1–50 year horizon required');
  const resolved=resolveHousingModel(run.modelVersion);
  if(!resolved.model.metrics.some(m=>m.id===metricId)) throw Error('Unsupported metric');
  if(typeof run.metrics?.[metricId]!=='number'||!Number.isFinite(run.metrics[metricId])||resolved.model.parameters.some(p=>typeof run.sampledParameters[p.id]!=='number'||!Number.isFinite(run.sampledParameters[p.id]))) throw Error('Complete finite effective inputs and recorded metric required');
  for(const f of factors) {const def=resolved.model.parameters.find(p=>p.id===f.id);if(!def||f.levels.some(v=>v<def.min||v>def.max)) throw Error('Unsupported factor or bounds');}
  const check=runHousingCounterfactual({run,scenario,years,metricId,parameterId:factors[0].id,value:factors[0].levels[0]});
  if(check.recordedMismatch.length) throw Error('Recorded reconstruction mismatch');
  const input={parameters:structuredClone(run.sampledParameters),years,projects:structuredClone(run.inputProjects??scenario.projects??run.projects?.map(p=>p.proposal)??[]),scheduledStress:structuredClone(run.scheduledStress??scenario.scheduledStress??[])};
  const fork=run.fork||scenario.timelineFork||scenario.fork;if(fork) input.fork=structuredClone(fork);
  const result=await evaluateFactorial({factors,seeds,budget,distribution},({parameters,seed})=>resolved.simulateRun({...structuredClone(input),parameters:{...input.parameters,...parameters},seed}).metrics[metricId],{signal,onProgress});
  return {...result,provenance:{sourceRunId:run.id??null,scenarioId:run.scenarioId??scenario.id??null,modelVersion:run.modelVersion,years,metricId,unit:resolved.model.metrics.find(m=>m.id===metricId).unit,input,empirical:false}};
}
