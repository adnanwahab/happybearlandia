import {runPartialDependence} from '../intelligence.js';
import {runHousingCounterfactual} from '../../models/housing/index.js';
/** Cross-engine arithmetic audit, not a statistical or model-error tolerance.
 * Preserve every difference and refuse discrepancies beyond floating arithmetic.
 * This never changes stored metrics or the reconstructed model output. */
export const RECONSTRUCTION_TOLERANCE = {absolute:1e-8,relative:64*Number.EPSILON};
export function auditRecordedMetrics(recorded, reconstructed) {
  const comparisons=Object.entries(recorded||{}).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).map(([metricId,stored])=>{
    const rerun=reconstructed?.[metricId];
    const tolerance=Math.max(RECONSTRUCTION_TOLERANCE.absolute,RECONSTRUCTION_TOLERANCE.relative*Math.max(Math.abs(stored),Math.abs(rerun)));
    const delta=rerun-stored;
    return {metricId,stored,rerun,delta,tolerance,accepted:typeof rerun==='number'&&Number.isFinite(rerun)&&Math.abs(delta)<=tolerance};
  });
  return {version:'housing-arithmetic-audit.v1',...RECONSTRUCTION_TOLERANCE,comparisons,
    mismatches:comparisons.filter(c=>!c.accepted).map(c=>c.metricId),
    roundoff:comparisons.filter(c=>c.accepted&&c.delta!==0),
    method:'Cross-engine floating arithmetic tolerance only; every retained difference is disclosed, not an empirical uncertainty interval.'};
}
export function runHousingDiagnosticCounterfactual(options) {
  const result=runHousingCounterfactual(options);
  const reconstructionAudit=auditRecordedMetrics(options?.run?.metrics,result.baseline.metrics);
  return {...result,recordedMismatch:reconstructionAudit.mismatches,reconstructionAudit,
    warnings:[...result.warnings.filter(w=>!w.startsWith('Reconstructed inputs do not reproduce')),
      ...(reconstructionAudit.mismatches.length?['Recorded reconstruction differs beyond arithmetic tolerance; interpretation blocked.']:[]),
      ...(reconstructionAudit.roundoff.length?['Tiny cross-engine arithmetic differences retained in reconstructionAudit.']:[])]};
}

/** Normal PDP reruns with auditable cross-engine source validation. */
export async function runHousingPartialDependence({runs,scenarios=[],years,...options}) {
  const audits=new Map();
  const result=await runPartialDependence({...options,runs,rerun:({run,...edit})=>{
    const response=runHousingDiagnosticCounterfactual({run,scenario:scenarios.find(s=>s.id===run.scenarioId),years,...edit});
    audits.set(run.id,{runId:run.id,seed:run.seed,modelVersion:run.modelVersion,...response.reconstructionAudit});
    return response;
  }});
  return {...result,years,reconstructionAudits:[...audits.values()]};
}
