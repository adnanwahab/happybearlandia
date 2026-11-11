import { classifyOutcomes } from '../intelligence.js';

/** Independent deterministic clustering of evaluated failures. No imputation. */
export function clusterFailures({ experiment, runs = [], model, features = [], k = 3 } = {}) {
  if (!Number.isInteger(k) || k < 1 || k > 6) throw new RangeError('Use 1–6 clusters.');
  if (!features.length || features.length > 12 || new Set(features).size !== features.length || features.some(id => !model?.parameters?.some(p => p.id === id))) throw new Error('Choose 1–12 distinct registered parameter IDs.');
  if (runs.length > 10000) throw new RangeError('At most 10000 records.');
  const classified = classifyOutcomes({ experiment, runs, model });
  const failures = classified.filter(row => row.outcome === 'failure').map(row => row.run);
  const groups = new Map();
  for (const run of failures) {
    const key = JSON.stringify([run.scenarioId, run.modelVersion]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(run);
  }
  const output = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Duplicate run identity.');
    const valid = rows.filter(r => features.every(id => Number.isFinite(r.sampledParameters?.[id])));
    const normalization = features.map(id => { const values = valid.map(r => r.sampledParameters[id]); return { id, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, unit: model.parameters.find(p => p.id === id).unit }; });
    const varying = normalization.filter(f => f.max > f.min);
    const vectors = valid.map(r => varying.map(f => (r.sampledParameters[f.id] - f.min) / (f.max - f.min)));
    const distance = (a, b) => a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);
    const centers = vectors.length ? [vectors[0].slice()] : [];
    while (centers.length < Math.min(k, vectors.length)) {
      const scores = vectors.map(v => Math.min(...centers.map(c => distance(v, c))));
      const max = Math.max(...scores); if (!max) break;
      centers.push(vectors[scores.indexOf(max)].slice());
    }
    let labels = [], iterations = 0;
    for (; iterations < 50 && centers.length; iterations++) {
      const next = vectors.map(v => { const scores = centers.map(c => distance(v, c)); return scores.indexOf(Math.min(...scores)); });
      if (next.every((label, i) => label === labels[i])) break;
      labels = next;
      centers.forEach((center, index) => { const members = vectors.filter((_, i) => labels[i] === index); if (members.length) centers[index] = center.map((_, d) => members.reduce((sum, v) => sum + v[d], 0) / members.length); });
    }
    output.push({ scenarioId: rows[0].scenarioId, modelVersion: rows[0].modelVersion, failureCount: rows.length, excludedRunIds: rows.filter(r => !valid.includes(r)).map(r => r.id), normalization, iterations, clusters: centers.flatMap((center, index) => {
      const members = valid.filter((_, i) => labels[i] === index); if (!members.length) return [];
      return [{ id: `cluster-${index + 1}`, runIds: members.map(r => r.id), seeds: members.map(r => r.seed), centroid: Object.fromEntries(normalization.map(f => [f.id, f.max === f.min ? f.min : f.min + center[varying.indexOf(f)] * (f.max - f.min)])), squaredError: vectors.reduce((sum, v, i) => sum + (labels[i] === index ? distance(v, center) : 0), 0) }];
    }) });
  }
  return { version: 'failure-clustering.v1', method: 'Deterministic farthest-first k-means; min/max normalized effective inputs; 50 iteration limit; complete cases only. Statistical grouping, not causal attribution or empirical calibration.', inputCount: runs.length, evaluatedCount: classified.filter(r => r.outcome !== 'unclassified').length, failureCount: failures.length, groups: output };
}
