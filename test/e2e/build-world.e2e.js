import { test, expect } from '@playwright/test';
test.use({ actionTimeout: 15000 });
const tool = page => page.locator('.world-tools');
const snapshot = page => page.evaluate(() => JSON.stringify(window.hblDecisionStudio.currentInput()));
async function preview(page, prompt) {
  await tool(page).locator('[data-action="edit-world"]').click();
  await tool(page).locator('[data-provider]').selectOption('demo');
  await tool(page).locator('[data-prompt]').fill(prompt);
  await tool(page).locator('[data-action="request-edit"]').click();
  await expect(tool(page).locator('[data-preview]')).toBeVisible();
  await expect(tool(page).locator('[data-action="approve"]')).toBeEnabled();
}
async function completed(page) {
  await expect.poll(() => page.evaluate(() => {
    const state = window.hblDecisionStudio.state;
    return state.experiment?.status === 'completed' && !state.busy;
  }), { timeout: 60000 }).toBe(true);
  return page.evaluate(() => structuredClone(window.hblDecisionStudio.state.results));
}

test('flagship: AI preview/reject/approve, monthly 3D construction, history, share and reproduction', async ({ page, context }) => {
  test.setTimeout(120000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const file of ['provider','provider-api','openai','anthropic','gemini']) expect((await page.request.get(`/world/ai/${file}.js`)).status()).toBe(404);
  await page.goto('/world/decision.html');
  await expect(page.locator('#parameter-permitting_months')).toBeVisible();
  await page.locator('#try-example').click();
  await page.locator('#auto-preview').uncheck();
  await expect(page.locator('.building-world canvas')).toBeVisible();
  const initial = await snapshot(page);
  await preview(page, 'Make construction capacity 20% higher');
  await expect(tool(page).locator('[data-diff]')).toContainText('86400');
  expect(await snapshot(page)).toBe(initial);
  await tool(page).locator('[data-action="reject"]').click();
  expect(await snapshot(page)).toBe(initial);
  await preview(page, 'Build a 300-unit residential tower near the station, with 25% affordable housing.');
  expect(await snapshot(page)).toBe(initial);
  await tool(page).locator('[data-action="approve"]').click();
  const results = await completed(page);
  const scenario = results.experiment.scenarios.find(row => row.id === 'plan-a');
  expect(scenario.projects).toHaveLength(1);
  expect(scenario.projects[0].program.affordableUnits).toBe(75);
  const stored = results.runs.find(row => row.scenarioId === 'plan-a');
  expect(stored.projects[0].states).toHaveLength(121);
  const middle = stored.projects[0].states.find(state => state.floorsBuilt >= 10 && state.floorsBuilt < scenario.projects[0].geometry.floors);
  expect(middle).toBeTruthy();
  const scrub = page.locator('#building-month');
  await scrub.fill(String(middle.month)); await scrub.dispatchEvent('input');
  await expect(page.locator('#building-project-summary')).toContainText(`floor ${middle.floorsBuilt}/24`);
  await page.locator('#building-world').screenshot({ path: '/private/tmp/hbl-building-construction.png' });
  await scrub.fill('120'); await scrub.dispatchEvent('input');
  await expect(page.locator('#building-project-summary')).toContainText('300 completed homes');
  await page.locator('#building-world').screenshot({ path: '/private/tmp/hbl-building-world.png' });
  await page.locator('.world-stage').screenshot({ path: '/private/tmp/hbl-build-world.png' });
  const recorded = await page.locator('#building-project-summary').innerText();
  await scrub.fill('0'); await scrub.dispatchEvent('input');
  await expect(page.locator('#building-project-summary')).toContainText('0 completed homes');
  await scrub.fill('120'); await scrub.dispatchEvent('input');
  expect(await page.locator('#building-project-summary').innerText()).toBe(recorded);
  const metrics = results.runs.map(row => row.metrics);
  await preview(page, 'Make the downtown towers taller');
  await expect(tool(page).locator('[data-classification]')).toContainText(/visual/i);
  await tool(page).locator('[data-action="approve"]').click();
  expect(await page.evaluate(() => window.hblDecisionStudio.state.results.runs.map(row => row.metrics))).toEqual(metrics);
  const visualResult = await page.evaluate(() => structuredClone(window.hblDecisionStudio.state.results));
  expect(visualResult.experiment.id).not.toBe(results.experiment.id);
  const appearanceShare = await context.newPage();
  await appearanceShare.goto(visualResult.experiment.shareUrl);
  await expect(appearanceShare.locator('#readonly-banner')).toBeVisible();
  expect(await appearanceShare.evaluate(() => window.hblDecisionStudio.currentInput().scenarios.find(row => row.id === 'plan-a').worldVisuals.heightScale)).toBe(1.2);
  expect(await appearanceShare.evaluate(() => window.hblDecisionStudio.state.results.runs.map(row => row.metrics))).toEqual(metrics);
  await appearanceShare.close();
  await tool(page).locator('[data-tab="history"]').click();
  await expect(tool(page).locator('[data-history]')).toContainText('demo');
  await tool(page).locator('[data-action="undo"]').click();
  expect(await page.evaluate(() => window.hblDecisionStudio.currentInput().metadata.worldEditHistory.length)).toBe(3);
  const shared = await context.newPage();
  await shared.goto(results.experiment.shareUrl);
  await expect(shared.locator('#readonly-banner')).toBeVisible();
  await expect(shared.locator('.world-tools [data-action="new-building"]')).toBeDisabled();
  await shared.close();
  const previousId = results.experiment.id;
  await page.locator('#reproduce-experiment').click();
  await expect.poll(() => page.evaluate(id => window.hblDecisionStudio.state.experiment?.id !== id, previousId)).toBe(true);
  const reproduced = await completed(page);
  expect(reproduced.runs.map(row => row.projects)).toEqual(results.runs.map(row => row.projects));
  expect(errors).toEqual([]);
});

test('flagship: manual build placement is editable and pure until its approve button', async ({ page }) => {
  await page.goto('/world/decision.html');
  await expect(page.locator('.building-world canvas')).toBeVisible();
  const initial = await snapshot(page);
  await tool(page).locator('[data-action="new-building"]').click();
  await tool(page).getByLabel('Residential units', { exact: true }).fill('310');
  await tool(page).locator('[data-action="place-building"]').click();
  const canvas = page.locator('.building-world canvas'); await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .72);
  await page.keyboard.press('r');
  await page.keyboard.press('+');
  await page.mouse.click(box.x + box.width * .65, box.y + box.height * .72);
  await expect(tool(page).locator('[data-status]')).toContainText('placed as a draft');
  expect(await snapshot(page)).toBe(initial);
  expect(Number(await tool(page).getByLabel('Rotation · radians', { exact: true }).inputValue())).toBeCloseTo(Math.PI / 4);
  await tool(page).getByRole('button', { name: 'Review project changes' }).click();
  await expect(tool(page).locator('[data-action="approve"]')).toBeEnabled();
  await tool(page).locator('[data-action="reject"]').click();
  expect(await snapshot(page)).toBe(initial);
  // A clean page must support building before the user tries/compiles a policy.
  await tool(page).locator('[data-action="new-building"]').click();
  await tool(page).getByRole('button', { name: 'Review project changes' }).click();
  await expect(tool(page).locator('[data-action="approve"]')).toBeEnabled();
  await tool(page).locator('[data-action="approve"]').click();
  const cleanRun = await completed(page);
  expect(cleanRun.experiment.scenarios.find(row => row.id === 'plan-a').projects).toHaveLength(1);
  expect(cleanRun.experiment.decision.length).toBeGreaterThan(0);
});

test('/world: existing town supports real building placement, explicit approval and stored monthly construction', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/outcomes', route => route.fulfill({ json: { outcomes: [] } }));
  await page.route('**/api/overpass-health', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/world?demo=1&people=30&renderer=webgl');
  const bridge = page.locator('[data-testid="world-building-tools"]');
  await expect(bridge).toBeAttached();
  await page.evaluate(async () => { for (let frame=0;frame<5;frame++) await new Promise(requestAnimationFrame); });
  expect(errors, 'Existing town initialization errors').toEqual([]);
  await bridge.locator(':scope > summary').click();
  await bridge.locator('[data-action="new-building"]').click();
  const suggested = {
    x: Number(await bridge.getByLabel('East / west · meters', { exact: true }).inputValue()),
    z: Number(await bridge.getByLabel('North / south · meters', { exact: true }).inputValue()),
  };
  await bridge.locator('[data-action="place-building"]').click();
  // The bridge focuses its suggested, validated parcel. Wait for camera matrices
  // to render before raycasting through the true canvas midpoint.
  await page.evaluate(async () => { for (let frame=0;frame<5;frame++) await new Promise(requestAnimationFrame); });
  const canvas = page.locator('#view canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(bridge).toHaveAttribute('open', '');
  await expect(bridge.locator('[data-status]')).toContainText('placed as a draft');
  expect(Number(await bridge.getByLabel('East / west · meters', { exact: true }).inputValue())).toBeCloseTo(suggested.x, 0);
  expect(Number(await bridge.getByLabel('North / south · meters', { exact: true }).inputValue())).toBeCloseTo(suggested.z, 0);
  await bridge.getByRole('button', { name: 'Review project changes' }).click();
  await expect(bridge.locator('[data-preview]')).toBeVisible();
  await bridge.locator('[data-action="approve"]').click();
  await expect(bridge.locator('.bw-bridge-status')).toContainText('40 / 40', { timeout: 60000 });
  await bridge.locator('[data-bw-month]').fill('120'); await bridge.locator('[data-bw-month]').dispatchEvent('input');
  await page.locator('#view').screenshot({ path: '/private/tmp/hbl-existing-world-building.png' });
  const exactLink = await bridge.locator('[data-bw-link]').getAttribute('href');
  expect(exactLink).toMatch(/decision\.html\?experiment=/);
  const id = new URL(exactLink, page.url()).searchParams.get('experiment');
  const result = await (await page.request.get(`/api/decision-experiments/${id}/results`)).json();
  const projectRun = result.runs.find(row => row.scenarioId === 'plan-a');
  expect(projectRun.projects[0].states.some(state => state.floorsBuilt > 0)).toBe(true);
  expect(projectRun.projectMetrics.completedUnits).toBeGreaterThan(0);
  const storedMonth=projectRun.projects[0].states.find(state=>state.month===120);
  await expect(bridge.locator('.bw-selection')).toContainText('Month: 120');
  await expect(bridge.locator('.bw-selection')).toContainText(`Completed units: ${storedMonth.completedUnits}`);
  await expect(bridge.locator('.bw-selection')).toContainText(`Phase: ${storedMonth.status}`);
});
