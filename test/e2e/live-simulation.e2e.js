import { test, expect } from '@playwright/test';
import { buildCivicExperiment } from '../../world/civic-experiment.js';

const sample = buildCivicExperiment({ packages: [{
  id: 'live_housing_sample',
  title: 'Housing supply and affordability',
  summary: 'Build affordable homes and streamline permitting near transit.',
  items: [{ proposal: { id: 'homes', title: 'Fund affordable construction and expand transit infrastructure', needId: 'housing_cost' } }],
}] }, { runs: 12, years: 10, seed: 42 }, new Date('2026-11-02T12:00:00Z'));

async function settled(page) {
  await expect(page.locator('#live-status')).toContainText('Up to date');
  await expect(page.locator('#live-timeline [aria-busy]')).toHaveAttribute('aria-busy', 'false');
  return page.evaluate(() => structuredClone(window.hblExperimentLab.liveResult));
}

async function changeRange(locator, value) {
  await locator.fill(String(value));
  await locator.dispatchEvent('input');
  await locator.dispatchEvent('change');
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/world/experiment-lab.html');
  await page.locator('#json-input').fill(JSON.stringify({ civicExperiment: sample }));
  await page.locator('#load-json').click();
  await expect(page.locator('#status')).toContainText(sample.id);
  await settled(page);
  expect(errors, 'Lab module initialization errors').toEqual([]);
});

test('parameter edits change yearly current results while the paired baseline stays fixed', async ({ page }) => {
  const initial = await settled(page);
  expect(initial.baseline.timeline).toHaveLength(10);
  expect(initial.current.timeline).toEqual(initial.baseline.timeline);
  const capacity = page.locator('#live-parameters [data-variable-id="agency_capacity"] input[type="range"]');
  const bounds = await capacity.evaluate(input => ({ min: input.min, max: input.max, value: input.value }));
  const target = bounds.value === bounds.min ? bounds.max : bounds.min;
  await changeRange(capacity, target);
  const edited = await settled(page);
  expect(edited.baseline.timeline).toEqual(initial.baseline.timeline);
  expect(edited.current.timeline).toHaveLength(10);
  expect(edited.current.timeline).not.toEqual(initial.current.timeline);
  const changedYears = edited.current.timeline.filter((row, index) => JSON.stringify(row) !== JSON.stringify(initial.current.timeline[index]));
  expect(changedYears.length).toBeGreaterThan(1);
  await expect(page.getByRole('img', { name: 'Simulation time series' })).toBeVisible();
  await expect(page.getByLabel('Timeline metric')).toBeEnabled();
  const year = page.getByLabel('Simulation year', { exact: true });
  await changeRange(year, 0);
  await expect(year).toHaveAttribute('aria-valuetext', 'Year 1');
  await changeRange(year, 9);
  await expect(year).toHaveAttribute('aria-valuetext', 'Year 10');
  await expect(page.locator('#live-timeline [data-value="current"]')).not.toHaveText('—');
  await expect(page.locator('#live-timeline')).toContainText('Illustrative model output');
});

test('reset restores the original paired trajectories', async ({ page }) => {
  const initial = await settled(page);
  const parameter = page.locator('#live-parameters [data-variable-id="agency_capacity"] input[type="range"]');
  const min = await parameter.getAttribute('min');
  await changeRange(parameter, min);
  await settled(page);
  await page.locator('#live-parameters').getByRole('button', { name: 'Reset all parameters', exact: true }).click();
  const reset = await settled(page);
  expect(reset.baseline.timeline).toEqual(initial.baseline.timeline);
  expect(reset.current.timeline).toEqual(initial.current.timeline);
});

test('invalid values remain safe and rapid edits settle on the latest assumptions', async ({ page }) => {
  const initial = await settled(page);
  const numeric = page.locator('#live-parameters [data-variable-id="agency_capacity"] input[type="number"]');
  await expect(numeric).toBeVisible();
  await numeric.fill('');
  await numeric.dispatchEvent('input');
  await expect(numeric).toHaveAttribute('aria-invalid', 'true');
  // A browser number input cannot accept arbitrary text. Empty and out-of-range
  // entries exercise the control's own validation instead of bypassing the UI.
  const max = Number(await numeric.getAttribute('max'));
  await numeric.fill(String(max + 100));
  await numeric.dispatchEvent('input');
  await expect(numeric).toHaveValue(String(max));
  const range = page.locator('#live-parameters [data-variable-id="agency_capacity"] input[type="range"]');
  const min = Number(await range.getAttribute('min'));
  await changeRange(range, min);
  await changeRange(range, max);
  await changeRange(range, min);
  const latest = await settled(page);
  expect(latest.baseline.timeline).toEqual(initial.baseline.timeline);
  expect(await range.inputValue()).toBe(String(min));
  const expected = await page.evaluate(async () => {
    const { runLiveSimulation } = await import('/world/live-simulation.js');
    const state = window.hblExperimentLab;
    return runLiveSimulation({ experiment: state.experiment, overrides: state.overrides, seed: 42, years: 10, runs: 12 });
  });
  expect(latest.current.timeline).toEqual(expected.current.timeline);
  expect(JSON.stringify(latest.current.timeline)).not.toMatch(/NaN|Infinity|null/);
  await page.locator('#rerun-live').click();
  expect((await settled(page)).current.timeline).toEqual(expected.current.timeline);
});

test('a frozen Dear Congress snapshot link loads its plan without requesting a new synthesis', async ({ page }) => {
  const synthesisRequests = [];
  await page.route('**/api/plan', route => {
    synthesisRequests.push(route.request().url());
    return route.fulfill({ status: 500, json: { error: 'A frozen link must not synthesize a new plan' } });
  });
  await page.route('**/api/dear-congress/simulation-snapshots/frozen_housing', route => route.fulfill({
    json: { snapshot: { id: 'frozen_housing', plan: sample.plan } },
  }));
  await page.goto('/world/experiment-lab.html?simulation=frozen_housing&seed=17&years=6');
  await expect(page.locator('#status')).toContainText('Dear Congress snapshot frozen_housing');
  const result = await settled(page);
  expect(result.seed).toBe(17);
  expect(result.baseline.timeline).toHaveLength(6);
  expect(result.current.timeline).toEqual(result.baseline.timeline);
  const source = await page.evaluate(() => window.hblExperimentLab.experiment.plan.source);
  expect(source.simulationSnapshotId).toBe('frozen_housing');
  await expect(page.locator('#plan-summary')).toContainText(sample.plan.title);
  expect(synthesisRequests).toEqual([]);
});
