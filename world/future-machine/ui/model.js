/** Presentation helpers only: no simulation, causal inference, or cross-model identity mapping. */
export const LAST_MONTH = 120;
export function clampMonth(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(LAST_MONTH, Math.round(number))) : 0;
}
export function calendarLabel(month) {
  const offset = clampMonth(month);
  return `${new Intl.DateTimeFormat('en', {month:'short', timeZone:'UTC'}).format(new Date(Date.UTC(2026, offset, 1)))} ${2026 + Math.floor(offset / 12)}`;
}
export function formatMeasurement(value, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  const display=Math.abs(value)>0&&Math.abs(value)<0.01 ? String(value) : new Intl.NumberFormat('en', {maximumFractionDigits:2}).format(value===0?0:value);
  return `${display}${unit ? ` ${unit==='USD cumulative'?'USD total':unit}` : ''}`;
}
export function metricPresentation(metric) {
  const unit = metric?.unit || '';
  const available = metric?.available !== false && [metric?.baseline, metric?.intervention].every(value => typeof value === 'number' && Number.isFinite(value));
  return available ? {
    baseline:formatMeasurement(metric.baseline, unit), intervention:formatMeasurement(metric.intervention, unit),
    delta:`${metric.intervention - metric.baseline > 0 ? '+' : ''}${formatMeasurement(metric.intervention - metric.baseline, unit)}`,
    detail:metric.note || 'Modeled difference · WITH PLAN − WITHOUT PLAN',
  } : {baseline:'Unavailable', intervention:'Unavailable', delta:'Unavailable', detail:metric?.reason || metric?.note || 'No supported measurement for this month.'};
}

/** Direction is measured; it does not establish welfare. */
export function metricSemantics(key, metric) {
  if(metric?.available===false || ![metric?.baseline,metric?.intervention].every(Number.isFinite))return {tone:'unavailable',label:'Measurement unavailable'};
  const delta=metric.intervention-metric.baseline;
  if(delta===0)return {tone:'neutral',label:'No measured difference'};
  if(key==='spending')return {tone:'cost',label:delta>0?'Additional capital cost':'Lower capital spending; service benefit not established'};
  if(key==='rent')return {tone:'neutral',label:'Whole-stock mean, including new inventory; not incumbent rent savings'};
  return {tone:'change',label:'Measured change; model result'};
}

/** Require exactly one reciprocal occupied-unit join, never a district proxy. */
export function householdObservation(household, units=[]) {
  const matches=household?.unitId ? units.filter(unit=>unit.id===household.unitId) : [];
  const unit=matches.length===1 && matches[0].householdId===household.id && matches[0].status==='occupied' ? matches[0] : null;
  const rent=unit && Number.isFinite(unit.rent) && unit.rent>=0 ? unit.rent : null;
  const income=Number.isFinite(household?.income) ? household.income : null;
  return {income,savings:Number.isFinite(household?.savings)?household.savings:null,rent,
    burden:rent!==null && income>0 ? rent/income : null,unitId:rent!==null?unit.id:null};
}
export function householdSummary(row) {
  if(!row)return 'No matched household selected.';
  const arms=[['WITHOUT PLAN',row.baseline,row.baselineHousing],['WITH PLAN',row.plan,row.planHousing]];
  return `${row.baseline && row.plan?'Same City household ID in both futures.':'Household missing from one future; no matched comparison.'}\n`+arms.map(([label,household,housing])=>`${label}: income ${formatMeasurement(household?.income,'USD/month')}; savings ${formatMeasurement(household?.savings,'USD')}; rent ${formatMeasurement(housing?.rent,'USD/month')}; rent / income ${formatMeasurement(housing?.burden==null?null:housing.burden*100,'%')}.`).join('\n')+'\nRent requires an exact occupied unit ↔ household match; burden is rent divided by positive monthly income. Whole-stock mean rent includes new inventory and does not measure this household’s rent savings. Synthetic modeled observations.';
}
