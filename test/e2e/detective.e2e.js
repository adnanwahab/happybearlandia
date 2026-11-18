import {test,expect} from '@playwright/test';
test('ID-only mystery, evidence, reveal, saved reload and private source boundary',async({page,request})=>{
 await page.goto('/world/future-machine.html');await page.getByRole('link',{name:'Play Detective of Futures'}).click();
 await page.getByRole('button',{name:'Open new case'}).click();await expect(page.locator('#outcome')).toContainText('homes');expect(page.url()).not.toContain('fm=');expect(page.url()).toContain('experiment=');
 await page.getByRole('button',{name:'Compare home inventory'}).click();await expect(page.locator('#count')).toHaveText('1 distinct evidence steps');
 await page.getByRole('button',{name:'Follow anchored evidence trail'}).click();await expect(page.locator('#count')).toHaveText('2 distinct evidence steps');
 await page.getByRole('radio',{name:'Authorize 24 homes in district d1 for $1,000,000',exact:true}).check();await page.getByRole('button',{name:'Submit and reveal'}).click();await expect(page.locator('#reveal')).toContainText('Correct');await expect(page.locator('#download')).toBeVisible();
 await page.reload();await expect(page.locator('#reveal')).toContainText('Correct');
 expect((await request.get('/ops/detective/api.js')).status()).toBe(404);
 const metrics=await (await request.get('/api/detective')).json();expect(metrics.completedWithTwoEvidenceSteps).toBe(1);
});

test('keyboard mystery, optional hints, mobile reduced motion and unavailable recovery',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/detective.html?experiment=missing');
 await expect(page.getByRole('status').first()).toHaveText('Saved puzzle unavailable.');
 await expect(page.locator('main')).toBeHidden();
 const start=page.getByRole('button',{name:'Open new case'});
 await start.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#outcome')).toContainText('homes');
 await page.getByRole('button',{name:'Submit and reveal'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status').first()).toHaveText('Choose an answer first.');
 await page.getByRole('button',{name:'Compare home inventory'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('region',{name:'Evidence notebook'})).toContainText('baseline 36 homes; future 60 homes');
 await page.getByRole('button',{name:'Inspect completion event'}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('#evidence')).toContainText('24 completed homes');
 await page.getByRole('button',{name:'Follow anchored evidence trail'}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('#evidence')).toContainText('Building is absent');
 await expect(page.locator('#evidence')).toContainText('24 homes');
 await page.locator('summary').focus();await page.keyboard.press('Enter');
 await expect(page.locator('details')).toHaveAttribute('open','');
 await expect(page.locator('#count')).toHaveText('3 distinct evidence steps');
 const radio=page.getByRole('radio',{name:'Authorize 24 homes in district d1 for $1,000,000',exact:true});
 await radio.focus();await page.keyboard.press('Space');
 await page.getByRole('button',{name:'Submit and reveal'}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('#reveal')).toContainText('Correct');await expect(page.locator('#reveal')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-578-detective-after-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'.mini-symphony-evidence/SHE-578-detective-after-desktop.png',fullPage:true});
 await page.route('**/api/detective',route=>route.abort());
 await start.click();await expect(page.getByRole('status').first()).not.toHaveText('Loading…');
 await expect(page.locator('#reveal')).toContainText('Correct');
});

test('Rashomon navigation, missing data, sequential accounts and cancel pending read', async ({page, request}) => {
 await page.goto('/world/future-machine.html');
 await page.getByRole('link',{name:'Play Detective of Futures'}).click();
 const mystery=page.getByRole('region',{name:'Rashomon Mystery'});
 await mystery.getByRole('button',{name:'Open Rashomon Mystery'}).click();
 await expect(mystery.locator('[data-mystery-status]')).toContainText('No source data');
 expect((await request.post('/api/causality/world-scenario')).ok()).toBe(true);
 await mystery.getByRole('button',{name:'Open Rashomon Mystery'}).click();
 await expect(mystery.locator('[data-mystery-output]')).toContainText('Factual ledger');
 await expect(mystery.locator('[data-mystery-output]')).not.toContainText('Account 1/3');
 for(let i=1;i<=3;i++) {
  await mystery.getByRole('button',{name:'Reveal next account'}).click();
  await expect(mystery.locator('[data-mystery-output]')).toContainText(`Account ${i}/3`);
 }
 await expect(mystery.locator('[data-mystery-output]')).toContainText('Mystery resolved');
 await expect(mystery.locator('[data-mystery-output]')).toContainText('Cause: unknown');
 await mystery.getByRole('button',{name:'Cancel mystery'}).click();
 await expect(mystery.locator('[data-mystery-output]')).toBeEmpty();
 let release; const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/causality/run?*',async route=>{await gate;await route.continue();});
 await mystery.getByRole('button',{name:'Open Rashomon Mystery'}).click();
 await expect(mystery.locator('[data-mystery-status]')).toContainText('Reading');
 const completed=page.waitForResponse(response=>response.url().includes('/api/causality/run?'));
 await mystery.getByRole('button',{name:'Cancel mystery'}).click(); release();
 await completed;
 await expect(mystery.locator('[data-mystery-status]')).toHaveText('Cancelled. No results retained.');
 await expect(mystery.locator('[data-mystery-output]')).toBeEmpty();
 await page.unroute('**/api/causality/run?*');
 await page.route('**/api/causality/state?*',async route=>{
  const response=await route.fetch();const body=await response.json();body.state.seed++;
  await route.fulfill({response,json:body});
 });
 await mystery.getByRole('button',{name:'Open Rashomon Mystery'}).click();
 await expect(mystery.locator('[data-mystery-status]')).toContainText('could not be verified');
 await expect(mystery.locator('[data-mystery-output]')).toBeEmpty();
});
