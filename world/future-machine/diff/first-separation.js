/** Presentation selector over validated compareHistory output. No causal inference.
 * Any exact entity field/presence change or finite nonzero recorded metric counts;
 * policy/project changes count, even before a physical building changes.
 * A missing earlier month prevents a claim of the earliest supported separation.
 */
export function firstSeparation(diffs = []) {
  for (let month = 0; month <= 120; month++) {
    const rows = diffs.filter(row => row?.month === month);
    if (rows.length !== 1 || rows[0].available !== true) return {status:'unavailable', month};
    const diff = rows[0];
    const entities = [...(diff.entities || [])].sort((a,b) =>
      a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const metric = Object.keys(diff.metrics || {}).sort().find(key => {
      const value = diff.metrics[key];
      return Number.isFinite(value.baseline) && Number.isFinite(value.plan) && Number.isFinite(value.delta) && value.delta !== 0;
    });
    if (entities.length || metric) return {status:'found', month,
      entity:entities.length ? {collection:entities[0].collection,id:entities[0].id} : null,
      metric:metric ?? null};
  }
  return {status:'none'};
}
