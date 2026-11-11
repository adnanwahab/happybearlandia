/** Present existing evaluation evidence without inventing missing metadata. */
export function methodologyReport(result) {
 if (!Array.isArray(result?.metrics)) throw new Error('An evaluation result is required');
 const warnings = [];
 for (const row of result.metrics) {
  if (!row.metricId || !Number.isFinite(row.observed) || !Number.isFinite(row.predictedMean)) warnings.push('Missing or nonfinite metric evidence; do not interpret this row as scored coverage.');
  if (!row.unit) warnings.push(`Unit not recorded for ${row.metricId || 'unknown metric'}; verify against the model contract before comparison.`);
 }
 const overlap = Date.parse(result.targetDate) <= Date.parse(result.cutoff);
 return structuredClone({evidence: { sourceObservations: result.sources ?? [], simulatedMetrics: result.metrics, sourceBackedParameters: result.sourceBackedParameters ?? null, syntheticParameters: result.syntheticParameters ?? null, calibrationMetadata: result.calibrationAudit ? 'Recorded fit audit; not policy validation' : 'Unavailable', temporalStatus: overlap ? 'Cutoff overlaps or follows target: retrospective only' : 'Check measurement periods and release vintages independently', warnings }, schemaVersion:'methodology-report.v1', kind:result.diagnostic?'Retrospective diagnostic':result.dataset?.synthetic!==false?'Synthetic mechanics evaluation':'User-supplied historical evaluation', empiricalDefaultValidated:false, dataset:result.dataset, sources:result.sources??[], cutoff:result.cutoff, startDate:result.startDate, targetDate:result.targetDate, modelVersion:result.modelVersion??null, seed:result.seed, runSeeds:result.runSeeds??null, parameters:result.parameters, fit:{count:result.trainingCount??null, dates:result.trainingDates??[], method:result.calibration, audit:result.calibrationAudit??null}, holdout:{count:result.evaluationCount??null, date:result.observedDate, excluded:result.excludedCount??null}, ensemble:{requested:result.runs, successful:result.successful, failed:result.failed, errors:result.errors??[]}, metrics:result.metrics, limitations:[...(result.limitations??[]),'Simulated p10–p90 ranges are not validated forecast bands. Coverage is descriptive per observation.', 'No verified blind empirical default or policy-validity claim is established. Missing metadata remains unknown.']});
}
const escape = value => String(value).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export function mountMethodology(element,result) {
 const report=methodologyReport(result);
 element.innerHTML='<article aria-label="Model methodology and limitations"><h1>Model methodology and limitations</h1><p>Fit uses pre-cutoff inputs; held-out observations are scored after simulation. Errors retain metric units. The published Houston ACS example is a retrospective stock diagnostic with overlapping survey periods.</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%">'+escape(JSON.stringify(report,null,2))+'</pre></article>';
 return report;
}

/** Exact JSON artifact corresponding to the mounted report, with nonfinite values explicitly flagged in evidence warnings. */
export function serializeMethodology(result) { return JSON.stringify(methodologyReport(result), null, 2); }
