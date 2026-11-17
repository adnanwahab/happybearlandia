import { expect, test } from '@playwright/test';

test('observe a district, approve a policy, lock a prediction and reveal its exact outcome', async ({ page }) => {
  await page.goto('/world/learning/');
  await expect(page.locator('#round-status')).toContainText('Baseline ready');
  const assembly = page.locator('#assembly');
  const observatory = page.locator('#observatory');
  await assembly.getByLabel('Policy proposal').selectOption('transit-d1-4');
  await assembly.getByLabel('Your vote').selectOption('support');
  await assembly.getByRole('button', { name: 'Cast vote' }).click();
  await expect(assembly.getByRole('status')).toContainText('Proposal did not pass.');

  await observatory.getByLabel('District', { exact: true }).selectOption('d1');
  await observatory.getByRole('button', { name: 'Add sensor' }).click();
  await expect(observatory.getByRole('heading', { name: /Riverside · Mean commute/ })).toBeVisible();
  await assembly.getByRole('button', { name: 'Cast vote' }).click();
  await expect(assembly.getByRole('status')).toContainText('Proposal approved.');
  await expect(observatory.getByRole('button', { name: 'Add sensor' })).toBeDisabled();

  const prediction = page.locator('#prediction');
  const reveal = page.getByRole('button', { name: 'Run approved future' });
  await expect(reveal).toBeDisabled();
  await prediction.locator('select[name=metric]').selectOption('meanCommuteMinutes');
  await prediction.locator('input[name=expected]').fill('-5');
  await prediction.getByRole('button', { name: 'Lock prediction' }).click();
  await expect(prediction.getByText(/Locked for month 14/)).toBeVisible();
  await expect(prediction.getByText('Accuracy score', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(prediction.getByText(/Locked for month 14/)).toBeVisible();
  await reveal.click();
  await expect(page.locator('#reveal-status')).toHaveText('Approved future resolved at month 14.');
  await expect(prediction.getByText('Accuracy score', { exact: true })).toBeVisible();
  await page.reload();
  await expect(prediction.getByText('Accuracy score', { exact: true })).toBeVisible();

  const skillRow = prediction.locator('.hbl-prediction-result dl > div').filter({ has: page.getByText('Skill vs no-change', { exact: true }) });
  const savedSkill = await page.evaluate(() => JSON.parse(localStorage.getItem('hbl.learning.v1.outcomes'))[0].value.resolution.skill);
  expect(Number.isFinite(savedSkill)).toBe(true);
  await expect(skillRow.locator('dd')).toHaveText(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(savedSkill));
  // Old records remain readable without silently recomputing or rewriting them.
  const legacy = await page.evaluate(() => {
    const key = 'hbl.learning.v1.outcomes';
    const outcomes = JSON.parse(localStorage.getItem(key));
    delete outcomes[0].value.resolution.skill;
    delete outcomes[0].value.resolution.noChangeError;
    const raw = JSON.stringify(outcomes);
    localStorage.setItem(key, raw);
    return raw;
  });
  await page.reload();
  await expect(skillRow.locator('dd')).toHaveText('Unavailable');
  await expect(prediction.getByText('Accuracy score', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hbl.learning.v1.outcomes'))).toBe(legacy);

  await page.getByRole('link', { name: 'Replay approved future' }).click();
  await expect(page.getByRole('heading', { name: 'Month 14', exact: true })).toBeVisible();
  await expect(page.locator('#policies')).toContainText('Riverside · Transit capacity +4');
});
