import {test,expect} from '@playwright/test';

test('adjacent east/west neighborhoods preserve view settings and show camera-dependent loaded area',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/outcomes',route=>route.fulfill({json:{outcomes:[]}}));
  await page.route('**/api/overpass-health',route=>route.fulfill({json:{ok:true}}));
  await page.goto('/world?demo=1&people=20&renderer=webgl&quality=LOW&lat=29.7286&lng=-95.4746');
  const tile=page.locator('.tile-navigation');
  await expect(tile.locator('[data-tile-size]')).toContainText('Generated neighborhood extent');
  await expect(tile.locator('[data-tile-size]')).toContainText('0.753 km²');
  await expect(tile.locator('[data-view-size]')).toContainText('Visible loaded area');
  const before=await tile.evaluate(node=>Number(node.dataset.visibleSquareMeters));
  await page.mouse.move(600,650);await page.mouse.wheel(0,-350);
  await expect.poll(()=>tile.evaluate(node=>Number(node.dataset.visibleSquareMeters))).toBeLessThan(before);
  const zoomed=await tile.evaluate(node=>Number(node.dataset.visibleSquareMeters));
  await page.setViewportSize({width:1000,height:900});
  await expect.poll(()=>tile.evaluate(node=>Number(node.dataset.visibleSquareMeters))).not.toBe(zoomed);
  await page.getByRole('button',{name:'Load adjacent neighborhood to the east',exact:true}).click();
  await expect(page).toHaveURL(/tileCamera=/);
  await expect(page.locator('.tile-navigation')).toBeVisible();
  const east=new URL(page.url());expect(Number(east.searchParams.get('lng'))).toBeGreaterThan(-95.4746);expect(east.searchParams.get('demo')).toBe('1');expect(east.searchParams.get('renderer')).toBe('webgl');expect(east.searchParams.get('people')).toBe('20');expect(east.searchParams.get('quality')).toBe('LOW');
  await page.getByRole('button',{name:'Load adjacent neighborhood to the west',exact:true}).click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('lng')).toBe('-95.4746000');
  await expect(page.locator('.tile-navigation [data-view-size]')).toBeVisible();
  console.log('Loaded/readout:',await page.locator('[data-tile-size]').textContent(),await page.locator('[data-view-size]').textContent());
  await page.screenshot({path:'/private/tmp/hbl-world-tile-navigation.png'});
  expect(errors).toEqual([]);
});
