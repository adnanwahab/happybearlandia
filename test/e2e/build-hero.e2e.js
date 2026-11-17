import {test,expect} from '@playwright/test';
test('ground wish is a detached preview; approved entity has recorded construction, occupancy, diff and ghost',async({page})=>{
  await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));
  await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
  await page.goto('/world?demo=1&people=30&renderer=webgl');
  const bridge=page.getByTestId('world-building-tools');
  await expect(bridge).toBeAttached();
  await page.getByTestId('build-something').click();
  await expect(bridge).toHaveAttribute('open','');
  // The normal manual action focuses a validated free parcel. Then use an actual
  // ground gesture at that location to exercise the wish flow instead of placing.
  await bridge.locator('[data-action=new-building]').click();
  await bridge.locator('[data-action=place-building]').click();
  await page.keyboard.press('Escape');
  await page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame)});
  const canvas=page.locator('#view canvas'),box=await canvas.boundingBox();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});
  const bubble=page.locator('.bw-ground-wish');
  await expect(bubble).toBeVisible();
  await bubble.getByRole('textbox').fill('Build a 24-story, 310-unit apartment tower here');
  await bubble.getByRole('button',{name:'Review wish'}).click();
  await expect(bridge.locator('[data-preview]')).toBeVisible();
  await expect(bridge.locator('[data-validation]')).toContainText('Accepted as a draft');
  await expect(bridge.locator('[data-bw-diff]')).toContainText('No approved');
  await bridge.locator('[data-action=approve]').click();
  await expect(bridge.locator('.bw-bridge-status')).toContainText('40 / 40',{timeout:60000});
  const scrub=bridge.locator('[data-bw-month]');
  await scrub.fill('120');await scrub.dispatchEvent('input');
  const row=bridge.locator('[data-bw-diff] [data-entity-id]').first();
  const entity=await row.getAttribute('data-entity-id');expect(entity).toBeTruthy();
  await expect(bridge.locator('.bw-selection')).toContainText(`Model entity ID: ${entity}`);
  await expect(row).toContainText('occupied homes');
  const toggle=bridge.locator('[data-bw-before]');
  await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(bridge.locator('.bw-selection')).toContainText('Before this intervention');
  await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','false');
  await scrub.fill('0');await scrub.dispatchEvent('input');
  await expect(row).toContainText('0 completed homes');
});
