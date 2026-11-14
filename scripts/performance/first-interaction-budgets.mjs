import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const metrics = ['jsBytes', 'readyMs', 'renderMs', 'peakHeapBytes'];
export function chooseLimits(samples) {
  if (samples.length < 3) throw new Error('Need at least three cold samples');
  return Object.fromEntries(metrics.map(key => {
    if (samples.some(row => !Number.isFinite(row[key]) || row[key] <= 0)) throw new Error(`Missing or invalid ${key}`);
    // Fixed 25% regression allowance, rounded upward to the measurement unit.
    return [key, Math.ceil(Math.max(...samples.map(row => row[key])) * 1.25)];
  }));
}
export function assertLimits(limits) {
  for (const key of metrics) {
    if (!Number.isFinite(limits[key]) || limits[key] <= 0) throw new Error(`Uncalibrated budget: ${key}`);
  }
}
export function limitsFromReport(report, profile, runs) {
  if (report.schemaVersion !== 'hbl.first-interaction.v1' || report.status !== 'passed') {
    throw new Error('Baseline must be a successful measurement report');
  }
  // Compare measurement settings, not old limits embedded in the report.
  for (const key of ['id', 'viewport', 'deviceScaleFactor', 'cpuSlowdown', 'network']) {
    if (JSON.stringify(report.profile?.[key]) !== JSON.stringify(profile[key])) {
      throw new Error(`Baseline profile mismatch: ${key}`);
    }
  }
  if (!Number.isInteger(runs) || runs < 3 || report.samples?.length !== runs) {
    throw new Error('Baseline must contain exactly the configured cold samples');
  }
  if (!report.commit || !report.browser?.version || !report.host?.cpu) {
    throw new Error('Baseline environment provenance is missing');
  }
  let identity;
  for (const [index, sample] of report.samples.entries()) {
    const evidence = sample.evidence;
    if (sample.run !== index || evidence?.seed !== 42 || evidence.month !== 16 ||
        !evidence.modelVersion || !evidence.initialHash ||
        !['webgl', 'webgpu', 'canvas2d'].includes(evidence.backend)) {
      throw new Error('Baseline sample provenance is missing or unsupported');
    }
    const current = JSON.stringify(evidence);
    if (identity && identity !== current) throw new Error('Baseline samples have inconsistent provenance');
    identity = current;
  }
  return chooseLimits(report.samples);
}
async function reportsUnder(root) {
  const reports = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) reports.push(...await reportsUnder(path));
    else if (entry.name === 'measurement.json') reports.push(JSON.parse(await readFile(path, 'utf8')));
  }
  return reports;
}
export async function generateProposal() {
  const reports = await reportsUnder('test-results/first-interaction');
  const config = JSON.parse(await readFile('test/performance/first-interaction-budgets.json', 'utf8'));
  const profiles = config.profiles.map(profile => {
    const matches = reports.filter(report => report.profile.id === profile.id);
    if (matches.length !== 1) throw new Error(`Expected exactly one report for ${profile.id}`);
    const baseline = matches[0];
    return { ...profile, limits: limitsFromReport(baseline, profile, config.runs), baseline };
  });
  await writeFile('test-results/first-interaction/budget-proposal.json', JSON.stringify({
    ...config, status: 'measured-proposal-awaiting-review', allowance: 1.25, profiles,
  }, null, 2));
}
