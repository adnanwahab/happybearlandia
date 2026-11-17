import {test, expect} from '@playwright/test';
for (const reduced of [false, true]) {
  test(`three native portal entries, reduced=${reduced}`, async ({page}, info) => {
    await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
    for(const [id,path] of [['future-machine','/world/future-machine.html'],['world','/world'],['living-city','/world']]) {
      await page.goto('/?tick=12');
      const link=page.locator(`.gallery-card[data-experience-id="${id}"] a`);
      await expect(link).toHaveAttribute('href', /tick=12/);
      await link.evaluate(a=>{const u=new URL(a.href);if(u.pathname==='/world'){u.searchParams.set('demo','1');u.searchParams.set('people','16');u.searchParams.set('synthetic','1');}a.href=u.href;});
      const destination=await link.getAttribute('href');
      await link.focus();
      if(!reduced) await page.screenshot({path:`.mini-symphony-evidence/SHE-390-portal-${id}-before.png`});
      if(id==='world') await link.click();
      else await link.press('Enter');
      await page.waitForURL(u=>u.pathname===path);
      await expect.poll(()=>page.evaluate(()=>document.activeElement?.dataset.navigationFocus === 'heading')).toBe(true);
      expect(new URL(page.url()).search).toBe(new URL(destination,'http://localhost').search);
      await expect(page.locator('.hbl-navigation-status')).toHaveText('Destination ready. Focus at page heading.');
      if(reduced) await expect(page.locator('html')).toHaveClass(/portal-reduced/);
      if(!reduced) await page.screenshot({path:`.mini-symphony-evidence/SHE-390-portal-${id}-after.png`});
      await page.goBack();
      await expect(page.locator(`a[data-portal-id="${id}"]`)).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

test('unsupported shared-element CSS retains native navigation', async ({page}) => {
  await page.addInitScript(() => { CSS.supports = () => false; });
  await page.goto('/?tick=7');
  const link=page.locator('a[data-portal-id="future-machine"]');
  await link.click();
  await page.waitForURL(/world\/future-machine.html/);
  expect(new URL(page.url()).searchParams.get('tick')).toBe('7');
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.dataset.navigationFocus === 'heading')).toBe(true);
  await expect(page.locator('[data-portal-active]')).toHaveCount(0);
});
