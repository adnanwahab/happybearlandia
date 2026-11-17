import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('normal entry, keyboard, narrow reduced-motion recap, download and print',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/future-machine.html?renderer=canvas');
 const create=page.getByRole('button',{name:'Create comic strip recap'});await create.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status').filter({hasText:'Recap unavailable'})).toBeVisible();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await create.focus();await page.keyboard.press('Enter');
 const recap=page.getByRole('region',{name:'Comic strip future recap'});
 await expect(recap.locator('article')).toHaveCount(6);await expect(recap.locator('svg')).toHaveCount(12);
 await expect(recap).toContainText('2027-05');await expect(recap).toContainText('not a historical photograph');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await recap.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('comic-mobile.png'),fullPage:true});
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Download printable recap'}).click();const download=await waiting;
 const html=await readFile(await download.path(),'utf8');expect(html).toContain('Pinned inputs and source provenance');expect(html).toContain('city-systems.');
 await page.setContent(html);await page.emulateMedia({media:'print'});
 await expect(page.locator('article')).toHaveCount(6);expect(await page.locator('pre').first().isVisible()).toBe(true);
 await page.pdf({path:info.outputPath('comic-print.pdf')});
});

test('denied comparison provides unavailable recap and no download',async({page})=>{
 await page.route('**/api/city-experiments',route=>route.fulfill({status:403,json:{error:'Access denied'}}));
 await page.goto('/world/future-machine.html?renderer=canvas');await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('error');
 await page.getByRole('button',{name:'Create comic strip recap'}).click();
 await expect(page.getByRole('region',{name:'Comic strip future recap'})).toContainText('Recap unavailable');
 await expect(page.getByRole('button',{name:'Download printable recap'})).toHaveCount(0);
});
