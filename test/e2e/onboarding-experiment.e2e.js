import { test, expect } from '@playwright/test';
const key = 'hbl.onboarding.v1';
for (const variant of ['direct','policy']) test(`${variant} exposure before clicks, reload stability, same demo destination`, async ({page}) => {
  await page.addInitScript(({variant,key}) => {
    // Deterministic random draw for enrollment, not a model seed.
    crypto.getRandomValues = array => { array.fill(variant === 'direct' ? 0 : 0xffffffff); return array; };
  }, {variant,key});
  await page.goto('/');
  await expect(page.getByText('Join the optional onboarding experiment')).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key),key)).toBeNull();
  await page.getByRole('checkbox',{name:'Join the optional onboarding experiment'}).check();
  const record = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)),key);
  expect((await record()).variant).toBe(variant);
  expect((await record()).events.map(e=>e.type)).toEqual(['exposure']);
  await page.reload(); await expect(page.getByRole('checkbox',{name:'Join the optional onboarding experiment'})).toBeChecked();
  expect((await record()).events.map(e=>e.type)).toEqual(['exposure']);
  // Abort destination computation: this smoke test concerns routing only.
  await page.route('**/world/future-machine.html?demo=1',route=>route.fulfill({contentType:'text/html',body:'Demo destination'}));
  await page.getByRole('link',{name:'Play Demo',exact:true}).click();
  if (variant === 'policy') {
    await expect(page.getByRole('button',{name:'What does the policy cost?'})).toBeVisible();
    await page.getByRole('button',{name:'What does the policy cost?'}).click();
  }
  await expect(page).toHaveURL(/\/world\/future-machine.html\?demo=1$/);
  expect((await record()).events.map(e=>e.type)).toEqual(variant === 'direct' ? ['exposure','start'] : ['exposure','choice','start']);
});
test('withdrawal erases evidence and restores ordinary demo',async({page})=>{
  await page.goto('/'); const consent=page.getByRole('checkbox',{name:'Join the optional onboarding experiment'});
  await consent.check(); await consent.uncheck();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),key)).toBeNull();
  await expect(page.getByRole('button',{name:'What does the policy cost?'})).toBeHidden();
  await expect(page.getByRole('link',{name:'Play Demo',exact:true})).toHaveAttribute('href','/world/future-machine.html?demo=1');
});
