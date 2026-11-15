import {test, expect} from '@playwright/test';

test.use({hasTouch:true});

for (const mobile of [false, true]) {
  test(`authored peek ${mobile ? 'touch' : 'keyboard and hover'} stays local offline`, async ({page, context}, testInfo) => {
    await page.setViewportSize(mobile ? {width:390,height:844} : {width:1440,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    const requests = [];
    page.on('request', request => requests.push({url:request.url(), type:request.resourceType()}));
    await page.goto('/');
    const card = page.locator('.gallery-card').first();
    const button = card.getByRole('button', {name:/Preview/});
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    await context.setOffline(true);
    const count = requests.length;
    if (mobile) await button.tap();
    else {
      await card.hover();
      await expect(button).toHaveAttribute('aria-expanded','true');
      await page.mouse.move(0,0);
      await button.focus();
    }
    await expect(card.locator('.peek-details')).toContainText('not a live simulation');
    await expect(button).toHaveAttribute('aria-expanded','true');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded','false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded','true');
    await expect(card.getByRole('link',{name:/Enter/})).toHaveAttribute('href','/world/bar');
    expect(requests.length).toBe(count);
    expect(requests.filter(r=>r.type === 'document')).toHaveLength(1);
    await expect(page.locator('#carousel-rail iframe')).toHaveCount(0);
    await page.screenshot({path:testInfo.outputPath(`peek-${mobile?'mobile':'desktop'}.png`)});
    await context.setOffline(false);
  });
}
test('old authored preview is labeled stale', async ({page}) => {
  await page.clock.setFixedTime(new Date('2027-01-01T00:00:00Z'));
  await page.goto('/');
  await page.locator('.gallery-card').first().getByRole('button',{name:/Preview/}).focus();
  await expect(page.locator('.peek-details').first()).toContainText('Stale preview');
});
