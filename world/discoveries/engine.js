const changeThreshold = 0.20;
const historyLength = 6;
const madMultiplier = 3 * 1.4826;

export const rules = {
  change: {
    label: 'Large monthly change',
    description: 'Two consecutive months differ by at least 20% of the larger absolute value.',
  },
  reversal: {
    label: 'Reversal',
    description: 'Two consecutive large monthly changes go in opposite directions.',
  },
  outlier: {
    label: 'Outlier',
    description: 'The value differs from the median of the previous six consecutive months by at least 20% of the larger absolute value and more than three scaled median absolute deviations (MAD × 1.4826). When MAD is zero, the 20% rule still applies.',
  },
};

function relativeDistance(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return 0;
  const difference = Math.abs(a - b);
  return Number.isFinite(difference) ? difference / scale : Math.abs(a / scale - b / scale);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
}

const byText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const byMonth = (a, b) => a.context.tick - b.context.tick;

/** Find patterns in one recorded monthly World run. Returns original records as evidence. */
export function discoverMonthlyObservations(run, observations) {
  const series = new Map();
  const labels = new Map((run.metadata?.metricDefinitions ?? []).map(metric => [metric.id, metric.label]));
  const findings = [];
  let usable = 0;
  let comparable = 0;
  let outlierWindows = 0;

  for (const row of observations) {
    if (row.context?.runId !== run.id || !Number.isSafeInteger(row.context.tick) || row.context.tick < 0 ||
        !row.entityId || !row.metricId) continue;
    const key = JSON.stringify([row.entityId, row.metricId]);
    if (!series.has(key)) series.set(key, []);
    series.get(key).push(row);
  }

  for (const rows of series.values()) {
    rows.sort(byMonth);
    let history = [];
    for (const [index, row] of rows.entries()) {
      const month = row.context.tick;
      if (!Number.isFinite(row.value) || !row.unit ||
          rows[index - 1]?.context.tick === month || rows[index + 1]?.context.tick === month) {
        history = [];
        continue;
      }
      usable++;
      const previous = history.at(-1);
      if (previous && (previous.context.tick + 1 !== month || previous.unit !== row.unit)) history = [];

      const addFinding = (kind, prior, statistics) => findings.push({
        kind, month, runId: run.id, entityId: row.entityId, metricId: row.metricId,
        label: labels.get(row.metricId) ?? row.metricId, unit: row.unit,
        evidence: [...prior, row], statistics,
      });

      if (history.length) {
        comparable++;
        const change = relativeDistance(previous.value, row.value);
        if (change >= changeThreshold) {
          addFinding('change', [previous], { change });
          const earlier = history.at(-2);
          if (earlier && relativeDistance(earlier.value, previous.value) >= changeThreshold &&
              (row.value > previous.value) !== (previous.value > earlier.value)) {
            addFinding('reversal', [earlier, previous], {
              firstChange: relativeDistance(earlier.value, previous.value), secondChange: change,
            });
          }
        }
      }

      if (history.length === historyLength) {
        outlierWindows++;
        const values = history.map(record => record.value);
        const center = median(values);
        const mad = median(values.map(value => Math.abs(value - center)));
        if (relativeDistance(row.value, center) >= changeThreshold &&
            Math.abs(row.value - center) > madMultiplier * mad) {
          addFinding('outlier', history, { median: center, mad });
        }
      }
      history.push(row);
      if (history.length > historyLength) history.shift();
    }
  }

  findings.sort((a, b) => b.month - a.month || byText(a.entityId, b.entityId) ||
    byText(a.metricId, b.metricId) || byText(a.kind, b.kind));
  return { findings, usable, comparable, outlierWindows };
}
