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
    return { ...profile, limits: chooseLimits(baseline.samples), baseline };
  });
  await writeFile('test-results/first-interaction/budget-proposal.json', JSON.stringify({
    ...config, status: 'measured-proposal-awaiting-review', allowance: 1.25, profiles,
  }, null, 2));
}
