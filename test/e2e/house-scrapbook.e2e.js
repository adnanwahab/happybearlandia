import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
test('keyboard privacy, source tick and unavailable fallback in reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('about:blank');
 await page.addScriptTag({content:readFileSync('world/house/scrapbook.js','utf8').replaceAll('export function','function')});
 await page.evaluate(async()=>{document.body.innerHTML='<main><div class="house-top-actions"></div></main>';window.scrapbook=mountHouseholdScrapbook(document.querySelector('main'),{storageKey:'scrapbook-test',load:async()=>({modelVersion:'fixture.v1',seed:42,checkpointTick:10,entries:[{id:'event1',title:'Recorded walk',tick:5,minute:5,synthetic:true,placeId:'park1',photos:[],source:{id:'event1',tick:5}}]})});});
 await page.getByRole('button',{name:'Life scrapbook'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByText('Remembered content is hidden on this device.')).toBeVisible();
 const hide=page.getByRole('checkbox');await hide.focus();await page.keyboard.press('Space');await expect(page.getByText('Recorded walk',{exact:true})).toBeVisible();
 await page.getByText('Open source tick 5',{exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('pre')).toContainText('event1');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-551-after-scrapbook.png'});
 await hide.focus();await page.keyboard.press('Space');await expect(page.getByText('Recorded walk',{exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.evaluate(async()=>{scrapbook.destroy();mountHouseholdScrapbook(document.querySelector('main'),{load:async()=>{throw Error('checkpoint missing');}});});
 await page.getByRole('button',{name:'Life scrapbook'}).click();await expect(page.getByRole('status')).toContainText('checkpoint missing');
});
