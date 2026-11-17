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
      const actualURL=new URL(page.url()),expectedURL=new URL(destination,actualURL.origin);
      expect({origin:actualURL.origin,pathname:actualURL.pathname,hash:actualURL.hash}).toEqual({origin:expectedURL.origin,pathname:expectedURL.pathname,hash:expectedURL.hash});
      // Context serialization can reorder keys; retain every value and duplicate.
      expect([...actualURL.searchParams].sort(([a],[b])=>a.localeCompare(b))).toEqual([...expectedURL.searchParams].sort(([a],[b])=>a.localeCompare(b)));
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


for (const reduced of [false, true]) {
  test(`primary launch and Back tolerate delayed transition styles, reduced=${reduced}`, async ({page}) => {
    await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 100, downloadThroughput: 1000000, uploadThroughput: 1000000,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('link', {name: 'Try the 60-second simulation', exact: true}).click();
    await page.waitForURL(url => url.pathname === '/world/future-machine.html');
    await page.waitForLoadState('load');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(errors).toEqual([]);
    await page.goBack();
    await expect(page.getByRole('link', {name: 'Try the 60-second simulation', exact: true})).toBeVisible();
    await page.waitForLoadState('load');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (reduced) await expect(page.locator('html')).toHaveClass(/portal-reduced/);
    expect(errors).toEqual([]);
  });
}

test('slow application startup preserves user focus and boot failure restores heading', async ({page}) => {
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/world/future-machine/main.js',async route=>{await gate;await route.continue();});
  await page.goto('/world/future-machine.html');
  await expect(page.locator('#boot h1')).toBeFocused();
  await page.evaluate(()=>{const input=document.createElement('input');input.id='startup-user-input';document.body.prepend(input);input.focus();});
  release();
  await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
  await expect(page.locator('#startup-user-input')).toBeFocused();
  await page.unroute('**/world/future-machine/main.js');
  await page.route('**/world/future-machine/main.js',route=>route.fulfill({contentType:'text/javascript',body:'throw new Error("Intentional startup failure for navigation regression");'}));
  await page.reload();
  await expect(page.getByText('Unable to load Future Machine. Refresh to retry.',{exact:true})).toBeVisible();
  await expect(page.locator('h1[data-navigation-focus="heading"]')).toBeFocused();
});
