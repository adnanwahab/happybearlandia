import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Measurements are audit candidates, not a WCAG conformance certificate.
const directory = process.env.HBL_A11Y_ARTIFACT_DIR || '/tmp/hbl-she-58';
test('primary World sheets retain text alternatives, keyboard dismissal and static progress', async ({ page }) => {
  mkdirSync(directory, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/world/?demo=1&synthetic=1&people=80&renderer=webgl');
  await page.waitForFunction(() => window.hblVisualPass?.ready);
  await page.getByTestId('quick-demo').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('quick-demo-status')).not.toHaveText('City ready. Play the quick demo.');
  await page.waitForFunction(() => window.hblVisualPass.getState().status === 'completed');
  await expect(page.getByTestId('quick-demo-status')).toContainText('Comparison complete');
  await expect(page.locator('.first-run-feedback')).toContainText('Seed:');
  await page.getByTestId('quick-demo-inspect').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspect')).toBeVisible();
  await page.keyboard.press('Escape');
  // Inspector trigger is inside the now suppressed guide; do not assert it can receive focus.
  await page.locator('#world-guide-button').click();
  const report = [];
  for (const id of ['guide', 'inspect', 'cycle', 'experiment', 'activity']) {
    const registered = await page.locator(`[data-world-panel="${id}"]`).count();
    if (!registered) { report.push({ id, unavailable: 'Not registered in this route/state' }); continue; }
    await page.evaluate(id => window.hblVisualPass.panels.open(id, { trigger: document.getElementById('world-guide-button') }), id);
    const panel = page.locator(`[data-world-panel="${id}"]`);
    await expect(panel).toBeVisible();
    await expect(panel).toBeFocused();
    report.push(await panel.evaluate(root => {
      const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      return {
        id: root.dataset.worldPanel, text: root.innerText,
        controls: [...root.querySelectorAll('button,a[href],input,select,textarea,summary')].filter(visible).map(el => {
          const r = el.getBoundingClientRect(), s = getComputedStyle(el);
          return { name: el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.id,
            width: r.width, height: r.height, disabled: !!el.disabled, color: s.color, background: s.backgroundColor };
        }),
        motion: { animation: getComputedStyle(root).animationName, transition: getComputedStyle(root).transitionDuration },
      };
    }));
    await page.screenshot({ path: `${directory}/${id}-mobile.png` });
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.locator('#world-guide-button')).toBeFocused();
  }
  writeFileSync(`${directory}/world-panels.json`, JSON.stringify(report, null, 2));
  expect(report.filter(row => row.unavailable)).toEqual([]);
});
