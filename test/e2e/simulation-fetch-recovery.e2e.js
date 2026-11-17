import { test, expect } from '@playwright/test';
import { buildCivicExperiment } from '../../world/civic-experiment.js';

const sample = buildCivicExperiment({ packages: [{ id: 'recovery', title: 'Housing', items: [] }] }, { runs: 2, years: 1, seed: 42 }, new Date('2026-11-02T12:00:00Z'));
for (const failure of ['offline', '500', 'timeout']) {
  test(`${failure}: preserve completed futures and recover through Run worlds`, async ({ page }) => {
    await page.addInitScript(() => { window.HBL_CIVIC_SIMULATOR_ENDPOINT = '/test-simulator'; });
    let failing = false, calls = 0;
    await page.route('**/test-simulator', async route => {
      calls++;
      if (failing) {
        if (failure === 'offline') return route.abort('internetdisconnected');
        if (failure === '500') return route.fulfill({ status: 500, body: '{}' });
        // Let the client's real timeout expire, including cancellation.
        return;
      }
      return route.fulfill({ json: { score: 63, metrics: { housing_units_permitted: 50 }, model: { id: 'recovery.v1', seed: 42 }, disclaimer: 'Synthetic test model; not a forecast.' } });
    });
    await page.goto('/world/experiment-lab.html');
    await page.locator('#json-input').fill(JSON.stringify({ civicExperiment: sample }));
    await page.locator('#load-json').click();
    await expect(page.locator('#status')).toContainText(sample.id);
    await page.locator('#generate-worlds').click();
    await page.locator('#run-simulations').click();
    await expect(page.locator('#run-simulations')).toBeEnabled();
    const saved = await page.evaluate(() => JSON.stringify(window.hblExperimentLab.simulationBatch));
    expect(JSON.parse(saved).simulations.length).toBeGreaterThan(0);
    const preview = await page.locator('#simulation-preview').textContent();
    failing = true; calls = 0;
    await page.locator('#run-simulations').click();
    await expect(page.locator('#simulation-summary')).toContainText('Earlier completed results remain visible.', { timeout: 30000 });
    expect(calls).toBe(JSON.parse(saved).simulations.length * 2);
    await expect(page.locator('#run-simulations')).toBeEnabled();
    expect(await page.evaluate(() => JSON.stringify(window.hblExperimentLab.simulationBatch))).toBe(saved);
    expect(await page.locator('#simulation-preview').textContent()).toBe(preview);
    await page.locator('#simulation-summary').scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`${failure}.png`) });
    failing = false;
    await page.locator('#run-simulations').click();
    await expect(page.locator('#run-simulations')).toBeEnabled();
    await expect(page.locator('#simulation-summary')).not.toContainText('unavailable');
    expect(await page.evaluate(() => JSON.stringify(window.hblExperimentLab.simulationBatch))).toBe(saved);
  });
}
