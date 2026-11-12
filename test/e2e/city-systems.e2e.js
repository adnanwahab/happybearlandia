import {test,expect} from '@playwright/test';
test('city laboratory runs paired futures, queries evidence and replays decisions',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/world/city-lab.html');
  await page.getByLabel('Futures per plan').fill('1');await page.getByLabel('Months',{exact:true}).fill('6');await page.getByLabel('Households',{exact:true}).fill('12');
  await page.locator('select[name=retention]').selectOption('analysis');await page.getByRole('button',{name:'Run baseline + plan'}).click();
  await expect(page.locator('#status')).toContainText('complete · 2 / 2 futures');await expect(page.locator('#metrics')).toContainText('meanRent');
  await page.getByRole('button',{name:'Data / SQL',exact:true}).click();
  await page.locator('#sql').fill('SELECT COUNT(*) AS futures FROM runs');await page.getByRole('button',{name:'Run query',exact:true}).click();await expect(page.locator('#results')).toContainText('2');
  await page.locator('#sql').fill('DELETE FROM runs');await page.getByRole('button',{name:'Run query',exact:true}).click();await expect(page.locator('#query-status')).toContainText('read-only');
  await page.getByRole('button',{name:'Enter future',exact:true}).first().click();await page.locator('#replay').click();await expect(page.locator('#status')).toContainText('Future regenerated');await expect(page.locator('#month')).toHaveText('Month 1');
  await page.locator('#timeline').fill('3');await expect(page.locator('#month')).toHaveText('Month 3');
  await page.getByRole('button',{name:'Lineage',exact:true}).click();await expect(page.locator('#manifest')).toContainText('synthetic-assumption');expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Compare',exact:true}).click();await page.screenshot({path:'/tmp/hbl-city-lab-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/hbl-city-lab-mobile.png',fullPage:true});
});

test('guided housing and drainage comparison saves evidence and reopens a replay',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/world/city-lab.html');
  await page.getByRole('button',{name:'Compare housing versus drainage',exact:true}).click();
  await expect(page.locator('#status')).toContainText('complete · 15 / 15 futures');
  await expect(page.locator('#metrics')).toContainText('housing');
  await expect(page.locator('#policy-flood')).toBeVisible();
  const rows=await page.locator('#policy-flood-results tbody tr').allTextContents();
  expect(rows).toHaveLength(3);
  await page.reload();
  await expect(page.locator('#status')).toContainText('complete · 15 / 15 futures');
  await expect(page.locator('#policy-flood-results')).toContainText('drainage');
  await page.getByRole('button',{name:'Lineage',exact:true}).click();
  await expect(page.locator('#manifest')).toContainText('housing-drainage.v1');
  await page.getByRole('button',{name:'Enter future',exact:true}).first().click();
  await page.locator('#replay-scenario').selectOption('drainage');
  await page.locator('#replay').click();
  await expect(page.locator('#status')).toContainText('Future regenerated');
  await page.locator('#timeline').fill('24');
  await expect(page.locator('#replay-events')).toContainText('FLOOD_DAMAGE');
  expect(errors).toEqual([]);
});
