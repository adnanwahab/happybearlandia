import { test, expect } from '@playwright/test';

test('heavy paired computation accepts pause and navigation before first pair completes', async ({ page }) => {
  await page.goto('/game');
  // Isolated controls exercise real browser tasks against the actual model module.
  await page.evaluate(async () => {
    const { buildTown } = await import('/world/gen.js');
    const { runPairedExperiment } = await import('/world/paired.js');
    document.body.innerHTML = '<button id="pause">Pause</button><a href="#inspection" id="navigate">Inspect</a>';
    const state = window.pairedStress = { progress: 0, stopped: false, status: 'running' };
    document.querySelector('#pause').onclick = () => { state.stopped = true; };
    const town = buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 500 });
    runPairedExperiment({ town, plan: { proposalIds: ['t_bus'] }, seeds: 100, checkpoints: [1, 6],
      shouldStop: () => state.stopped, onProgress: () => state.progress++,
    }).then(() => { state.status = 'complete'; }, error => { state.status = error.message; });
  });
  await page.locator('#navigate').click();
  await expect(page).toHaveURL(/#inspection$/);
  await page.locator('#pause').click();
  await expect.poll(() => page.evaluate(() => window.pairedStress.status)).toBe('experiment cancelled');
  expect(await page.evaluate(() => window.pairedStress.progress)).toBe(0);
});
