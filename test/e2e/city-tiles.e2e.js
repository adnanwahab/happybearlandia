import {test,expect} from '@playwright/test';
import {createCity,createCityFromArea} from '../../world/city/seed.js';
test.use({video:'on'});
test('saved replay spatial tiles preserve totals through motion and fallback',async({page,request},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const initial=createCityFromArea({source:'osm',origin:{lat:30,lng:-95},buildings:Array.from({length:24},(_,i)=>({id:`fixture-${i}`,pts:[[30,-95+i*.003],[30.0004,-95+i*.003],[30,-94.9996+i*.003]]}))},{seed:158,households:30});
 const response=await request.post('/api/city-experiments',{data:{initial,runs:1,months:2,scenarios:[{id:'baseline',interventions:[]}]}});expect(response.status()).toBe(202);const {id}=await response.json();
 await expect.poll(async()=> (await (await request.get(`/api/city-experiments/${id}`)).json()).status).toBe('complete');
 await page.goto(`/world/city-lab.html?experiment=${id}`);await expect(page.locator('#status')).toContainText('complete');await page.locator('[data-tab=trace]').click();await page.locator('#replay').click();await expect(page.locator('#status')).toContainText('Future regenerated');
 if(process.env.HBL_TILE_BASELINE){await page.screenshot({path:testInfo.outputPath('before.png'),fullPage:true});return;}
 const root=page.locator('#city-tiles');await root.scrollIntoViewIfNeeded();await expect(root.locator('[data-totals]')).toContainText('30 households');const totals=await root.locator('[data-totals]').textContent();
 await expect(root.locator('[data-stream]')).toHaveText(/[1-6] ready/);
 const canvas=root.locator('canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.down();for(let i=0;i<8;i++)await page.mouse.move(box.x+20+i*30,box.y+120+i*5);await page.mouse.up();
 await root.getByRole('button',{name:'Reset map view'}).click();await expect(root.locator('[data-totals]')).toHaveText(totals);
 await root.getByLabel('Summary only').check();await expect(root.locator('[data-stream]')).toContainText('Summary only');await expect(root.locator('[data-totals]')).toHaveText(totals);
 await page.screenshot({path:testInfo.outputPath('after-fallback.png'),fullPage:true});await root.getByLabel('Summary only').uncheck();await expect(root.locator('[data-stream]')).toHaveText(/[1-6] ready/);await page.screenshot({path:testInfo.outputPath('after.png'),fullPage:true});
 await page.locator('#timeline').fill('2');await expect(root.locator('[data-provenance]')).toContainText('month 2');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('no Canvas context keeps complete inventory accessible and disables detail',async({page,request})=>{
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
 const response=await request.post('/api/city-experiments',{data:{initial:createCity({seed:158,households:9}),runs:1,months:1,scenarios:[{id:'baseline',interventions:[]}]}});expect(response.status()).toBe(202);const {id}=await response.json();
 await expect.poll(async()=>(await (await request.get(`/api/city-experiments/${id}`)).json()).status).toBe('complete');await page.goto(`/world/city-lab.html?experiment=${id}`);await expect(page.locator('#status')).toContainText('complete');await page.locator('[data-tab=trace]').click();await page.locator('#replay').click();await expect(page.locator('#status')).toContainText('Future regenerated');
 const root=page.locator('#city-tiles');await expect(root.locator('[data-totals]')).toContainText('9 households');await expect(root.getByLabel('Summary only')).toBeChecked();await expect(root.getByLabel('Summary only')).toBeDisabled();await expect(root.locator('canvas')).toBeHidden();await root.locator('summary').click();await expect(root.locator('tbody tr')).toHaveCount(3);
});
