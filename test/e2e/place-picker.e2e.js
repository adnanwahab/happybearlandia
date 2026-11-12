import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/area?**',r=>r.fulfill({json:{source:'none',buildings:[],roads:[]}}));});
test('first time player selects in two clicks and reload retains seed',async({page})=>{
 await page.goto('/world?renderer=canvas2d');
 await page.getByRole('button',{name:'1 · Choose a place'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('[data-place]')).toHaveCount(6);
 await dialog.getByRole('button',{name:/Houston Museum District/}).click();
 await expect(page).toHaveURL(/seed=postcard-v1%3Amuseum/);await expect(page.locator('#canvas-lite-world')).toBeVisible();
 await page.reload();await expect(page.locator('#canvas-lite-world')).toBeVisible();await expect(page).toHaveURL(/seed=postcard-v1%3Amuseum/);
});
test('search, denied location, precise disclosure and keyboard dismissal',async({page})=>{
 await page.route('**/api/date-places?**',r=>r.fulfill({json:{places:[{name:'Test city',lat:30,lng:-95}]}}));
 await page.goto('/world?renderer=canvas2d');await page.getByRole('button',{name:'1 · Choose a place'}).click();const d=page.getByRole('dialog');
 await d.getByText('Somewhere else',{exact:true}).click();await d.getByLabel('Address or city').fill('Test city');await d.getByRole('button',{name:'Search',exact:true}).click();await expect(d.getByRole('button',{name:'Test city',exact:true})).toBeVisible();
 await d.getByText('Use my location',{exact:true}).click();await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail({code:1});});await d.getByRole('button',{name:'Agree and use my location'}).click();await expect(d.getByRole('alert')).toContainText('Location access unavailable');
 await expect(d.getByLabel('Latitude',{exact:true})).toBeHidden();await d.getByText('Precise location',{exact:true}).click();await expect(d.getByLabel('Latitude',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(d).not.toBeVisible();await expect(page.getByRole('button',{name:'1 · Choose a place'})).toBeFocused();
});
test('mobile pin selection navigates',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/world?renderer=canvas2d');await page.getByRole('button',{name:'1 · Choose a place'}).click();const d=page.getByRole('dialog');await d.getByText('Somewhere else',{exact:true}).click();await d.getByRole('button',{name:'World map: click to drop a pin'}).click();await d.getByRole('button',{name:'Visit pinned place'}).click();await expect(page).toHaveURL(/seed=place-v1/);});
