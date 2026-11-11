import {runHousingDiagnosticCounterfactual} from './reconstruction.js';
import {resolveHousingModel} from '../../models/housing/index.js';
import {evaluateFactorial,createFactorialDesign} from './design.js';
export async function runHousingFactorial({run,scenario={},years,metricId,factors,seeds=[run?.seed],budget=128,distribution,signal,onProgress}={}) {
  createFactorialDesign({factors,seeds,budget,distribution});
  if(!Number.isInteger(run?.seed)||run.seed<0||run.seed>4294967295) throw Error('Source run requires a uint32 seed');
  if(!run?.modelVersion||!run.sampledParameters||!Number.isInteger(years)||years<1||years>50) throw Error('Recorded version, effective sampledParameters and explicit 1–50 year horizon required');
  const resolved=resolveHousingModel(run.modelVersion);
  if(!resolved.model.metrics.some(m=>m.id===metricId)) throw Error('Unsupported metric');
  if(typeof run.metrics?.[metricId]!=='number'||!Number.isFinite(run.metrics[metricId])||resolved.model.parameters.some(p=>typeof run.sampledParameters[p.id]!=='number'||!Number.isFinite(run.sampledParameters[p.id]))) throw Error('Complete finite effective inputs and recorded metric required');
  for(const f of factors) {const def=resolved.model.parameters.find(p=>p.id===f.id);if(!def||f.levels.some(v=>v<def.min||v>def.max)) throw Error('Unsupported factor or bounds');}
  const check=runHousingDiagnosticCounterfactual({run,scenario,years,metricId,parameterId:factors[0].id,value:factors[0].levels[0]});
  if(check.recordedMismatch.length) throw Error('Recorded reconstruction mismatch');
  const input={parameters:structuredClone(run.sampledParameters),years,projects:structuredClone(run.inputProjects??scenario.projects??run.projects?.map(p=>p.proposal)??[]),scheduledStress:structuredClone(run.scheduledStress??scenario.scheduledStress??[])};
  const fork=run.fork||scenario.timelineFork||scenario.fork;if(fork) input.fork=structuredClone(fork);
  // A crossed level must remain an input intervention, rather than being
  // silently replaced/clamped by a later retained schedule or fork operation.
  const rejectStressOverride = presetId => {
    for (const factor of factors) for (const value of factor.levels) {
      const effective = resolved.applyStressPresets({...input.parameters,[factor.id]:value}, [presetId]);
      if (effective[factor.id] !== value) throw Error(`Factor ${factor.id} is overridden by retained stress ${presetId}; choose an unaffected factor`);
    }
  };
  for (const entry of input.scheduledStress) if (entry.startMonth <= years * 12) rejectStressOverride(entry.presetId);
  for (const operation of fork?.operations || []) {
    if (operation.op === 'set_parameter') {
      const id = operation.target.replace(/^scenario\./, '').replace(/^parameters\./, '');
      if (factors.some(f => f.id === id)) throw Error(`Factor ${id} is overridden by retained fork; choose an unaffected factor`);
    }
    if (operation.op === 'apply_stress_preset') rejectStressOverride(typeof operation.value === 'string' ? operation.value : operation.value?.presetId);
  }
  const result=await evaluateFactorial({factors,seeds,budget,distribution},({parameters,seed})=>resolved.simulateRun({...structuredClone(input),parameters:{...input.parameters,...parameters},seed}).metrics[metricId],{signal,onProgress});
  return {...result,provenance:{sourceRunId:run.id??null,scenarioId:run.scenarioId??scenario.id??null,modelVersion:run.modelVersion,years,metricId,unit:resolved.model.metrics.find(m=>m.id===metricId).unit,input,reconstructionAudit:check.reconstructionAudit,reconstructionExecutions:2,empirical:false}};
}
