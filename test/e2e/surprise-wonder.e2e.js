import {test, expect} from '@playwright/test';

test('ten homepage invocations navigate to valid curated pages and repeat by seed', async ({page}) => {
  const routes = new Set();
  for (let seed=0; seed<10; seed++) {
    await page.goto('/');
    const root=page.locator('#surprise-wonder');
    await root.getByLabel('Selection seed').fill(String(seed));
    await root.getByRole('button', {name:'Surprise Me', exact:true}).click();
    const link=root.locator('[data-change-world]');
    const route=await link.getAttribute('href');
    routes.add(route);
    await root.getByRole('button').click();
    await expect(link).toHaveAttribute('href',route);
    const response=await Promise.all([page.waitForNavigation(),link.click()]);
    expect(response[0].status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(routes.size).toBe(3);
});

for (const mobile of [false,true]) test(`keyboard/touch, local selection and evidence ${mobile}`, async ({page},info) => {
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const root=page.locator('#surprise-wonder');
  await expect(root).toBeVisible();
  await page.screenshot({path:info.outputPath(`before-${mobile}.png`),fullPage:true});
  await page.evaluate(() => {
    window.wonderNetworkCalls=[];
    window.fetch=(...args)=>{window.wonderNetworkCalls.push(String(args[0]));return Promise.reject(new Error('Unexpected network request'));};
    navigator.sendBeacon=(url)=>{window.wonderNetworkCalls.push(String(url));return false;};
  });
  // Disable unrelated gallery work while measuring selection's own network effects.
  await page.route('**/*',route=>route.abort());
  const button=root.getByRole('button');
  await button.focus();
  if(mobile) await button.tap(); else await page.keyboard.press('Enter');
  await expect(root.getByRole('status')).toContainText('Selection seed 42');
  await expect(root.getByRole('status')).toContainText('Synthetic');
  await expect(root.locator('[data-change-world]')).toBeVisible();
  expect(await page.evaluate(()=>window.wonderNetworkCalls)).toEqual([]);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.screenshot({path:info.outputPath(`after-${mobile}.png`),fullPage:true});
  await root.getByLabel('Selection seed').fill('43');
  await expect(root.locator('[data-change-world]')).toBeHidden();
});

test('component handles empty curation without a stale launch action', async ({page}) => {
  await page.goto('/');
  await page.evaluate(async()=>{
    const {mountSurprise}=await import('/world/universe/surprise.js');
    const clone=document.querySelector('#surprise-wonder').cloneNode(true);
    clone.id='empty-wonders'; document.body.prepend(clone);
    mountSurprise(clone,{available:[]});
  });
  const root=page.locator('#empty-wonders');
  await expect(root.getByRole('button')).toBeDisabled();
  await expect(root.getByRole('status')).toContainText('unavailable');
  await expect(root.locator('[data-change-world]')).toBeHidden();
});
