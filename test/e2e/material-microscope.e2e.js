import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
for(const mobile of [false,true])test(`normal World material inspection ${mobile?'mobile':'desktop'}`,async({page},info)=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});
 // Observation-only fixture hook invokes the same selection function as the scene picker.
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__inspectFixtureBuilding=()=>select({type:"building",id:0});'});});
 await page.goto('/world/?renderer=webgl&demo=1&synthetic=1&people=16&seed=653');
 await page.waitForFunction(()=>window.__inspectFixtureBuilding);
 await page.evaluate(()=>window.__inspectFixtureBuilding());
 const root=page.locator('[data-material-microscope]');await root.locator('summary').click();
 await expect(root).toContainText('construction material unknown');await expect(root).toContainText('Renderer-only');
 await root.getByLabel('Building surface').selectOption('roof');await expect(root).toContainText('Roof construction material unknown');
 await root.getByLabel('Building surface').focus();await page.waitForTimeout(600);await expect(root.getByLabel('Building surface')).toBeFocused();
 await root.getByRole('button',{name:'Open original source record'}).click();
 await expect(page.locator('[data-api-geometry] summary')).toBeFocused();
 await expect(page.locator('[data-api-geometry]')).toContainText('geometry');
 await root.locator('summary').focus();await page.keyboard.press('Enter');await expect(root).not.toHaveAttribute('open','');
 await page.keyboard.press('Enter');await expect(root).toHaveAttribute('open','');
 await page.screenshot({path:info.outputPath('materials.png')});
 expect(await root.evaluate(el=>el.materialMetrics.updateCpuMs)).toBeGreaterThanOrEqual(0);
});
test('component tagged, missing and failure states and removal',async({page})=>{
 await page.route('https://materials.test/**',route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/world/material-microscope.js'||path==='/world/geometry-inspector.js')return route.fulfill({contentType:'text/javascript',body:readFileSync('.'+path,'utf8')});
 return route.fulfill({contentType:'text/html',body:'<main></main>'});
 });
 await page.goto('https://materials.test/');
 await page.evaluate(async()=>{
 const {mountMaterialMicroscope}=await import('/world/material-microscope.js');
 const host=document.createElement('main');document.body.replaceChildren(host);
 const area={source:'osm',buildings:[{id:'w653',materialTags:{'building:material':'brick','roof:material':'slate'}}]};
 mountMaterialMicroscope(host,{area,buildingId:'w653'}).open=true;
 mountMaterialMicroscope(host,{area,buildingId:'missing'}).open=true;
 mountMaterialMicroscope(host,{area:{get buildings(){throw Error('fixture failure');}},buildingId:'failed'}).open=true;
 });
 await expect(page.locator('[data-material-microscope="w653"]')).toContainText('Contributor-reported wall material: brick');
 await page.getByLabel('Building surface').first().selectOption('roof');await expect(page.locator('[data-material-microscope="w653"]')).toContainText('slate');
 await expect(page.locator('[data-state="missing"] button')).toBeDisabled();await expect(page.locator('[data-state="failure"]')).toContainText('inspection failed');
 await page.evaluate(()=>document.querySelector('main').remove());await expect(page.locator('[data-material-microscope]')).toHaveCount(0);
});
