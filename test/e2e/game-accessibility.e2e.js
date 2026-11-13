import { test, expect } from '@playwright/test';

test('conversation supports focus, typing, modal isolation and Escape', async ({ page }) => {
  await page.goto('/game/1');
  await expect(page.locator('#container canvas')).toBeVisible();
  // Fixture uses the same scene/interaction events as the runtime.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hbl:conversation-scene', { detail: {
    npcs: [{ id: 'a11y-resident', name: 'Resident', conversations: [{ id: 'a11y', start: 'hello', tree: {
      hello: { speaker: 'Resident', text: 'Hello', choices: [{ text: 'Continue', next: 'bye' }] },
      bye: { speaker: 'Resident', text: 'Goodbye', end: true },
    } }] }],
  } })));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hbl:conversation-interaction', { detail: { npcId: 'a11y-resident' } })));
  const dialog = page.getByRole('dialog', { name: 'Conversation with Resident' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '1. Continue' })).toBeFocused();
  const prompt = dialog.getByRole('textbox', { name: 'Ask an open-ended question' });
  await prompt.focus();
  await page.keyboard.type('123 wasd');
  await expect(prompt).toHaveValue('123 wasd');
  await expect(dialog).toContainText('Hello');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
