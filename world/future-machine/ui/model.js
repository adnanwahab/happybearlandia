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
  const display=Math.abs(value)>0&&Math.abs(value)<0.01 ? `${value<0?'-':''}<0.01` : new Intl.NumberFormat('en', {maximumFractionDigits:2}).format(value===0?0:value);
  return `${display}${unit ? ` ${unit}` : ''}`;
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
