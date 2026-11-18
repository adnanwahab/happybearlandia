export const HISTOGRAM_OPTIONS = Object.freeze({ samples: 100, seed: 2911, amount: 8, months: 12 });

const ranges = [
  { upper: -60, label: 'Less than −60' },
  { upper: -40, label: '−60 to less than −40' },
  { upper: -20, label: '−40 to less than −20' },
  { upper: 0, label: '−20 to less than 0' },
  { upper: 0, label: 'Exactly 0' },
  { upper: 20, label: 'Greater than 0 to less than 20' },
  { upper: 40, label: '20 to less than 40' },
  { upper: 60, label: '40 to less than 60' },
  { upper: Infinity, label: '60 or more' },
];
const zeroBin = 4;

function missingCommute(arm) {
  return Number.isFinite(arm?.commuteMinutes) ? null : arm?.participant?.status ?? 'unavailable';
}

export function summarizeHistogram(samples) {
  const requested = HISTOGRAM_OPTIONS.samples;
  const byIndex = new Map();
  for (const sample of samples) {
    if (!Number.isInteger(sample.index) || sample.index < 0 || sample.index >= requested ||
        byIndex.has(sample.index)) {
      throw new Error('The simulation returned invalid sample indices.');
    }
    byIndex.set(sample.index, sample);
  }

  const bins = ranges.map(({ label }) => ({ label, count: 0 }));
  const missing = [];
  const unreported = [];
  const deltas = [];
  let shorter = 0;
  let longer = 0;
  for (let index = 0; index < requested; index++) {
    const sample = byIndex.get(index);
    if (!sample) {
      unreported.push(index);
      continue;
    }
    const baseline = missingCommute(sample.baseline);
    const intervention = missingCommute(sample.intervention);
    if (baseline || intervention) {
      missing.push({ index, seed: sample.seed, baseline, intervention });
      continue;
    }

    const delta = sample.intervention.commuteMinutes - sample.baseline.commuteMinutes;
    const bin = delta === 0 ? zeroBin : ranges.findIndex(({ upper }) => delta < upper);
    bins[bin].count++;
    deltas.push(delta);
    if (delta < 0) shorter++;
    if (delta > 0) longer++;
  }

  deltas.sort((a, b) => a - b);
  const measured = deltas.length;
  return {
    requested, measured, missing, unreported, bins, shorter, longer,
    unchanged: measured - shorter - longer,
    mean: measured ? deltas.reduce((sum, delta) => sum + delta, 0) / measured : null,
    median: measured ? (deltas[Math.floor((measured - 1) / 2)] + deltas[Math.floor(measured / 2)]) / 2 : null,
  };
}
