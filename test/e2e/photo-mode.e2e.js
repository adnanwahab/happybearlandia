import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`photo mode ${mobile?'mobile':'desktop'} restores framing and saves only requested receipt`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/?demo=1&synthetic=1&people=16&renderer=webgl');
 const open=page.getByRole('button',{name:'Open photo mode'});
 await expect(open).toBeVisible({timeout:90000});
 await page.screenshot({path:`.mini-symphony-evidence/SHE-526-before-photo-${mobile?'mobile':'desktop'}.png`});
 await open.click();const panel=page.getByRole('region',{name:'Photo mode'});
 await expect(page.getByRole('button',{name:'Save PNG'})).toBeFocused();
 await expect(page.locator('body')).toHaveClass(/hbl-photo/);
 await page.getByRole('button',{name:'Frame left',exact:true}).click();
 await page.getByRole('checkbox',{name:'Golden hour (cosmetic)',exact:true}).check();
 await expect(page.getByRole('checkbox',{name:'Include scene receipt'})).not.toBeChecked();
 await page.screenshot({path:`.mini-symphony-evidence/SHE-526-after-photo-${mobile?'mobile':'desktop'}.png`});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save PNG'}).click();const png=await download;expect(png.suggestedFilename()).toBe('world-postcard.png');await png.saveAs(`/private/tmp/she526-${mobile?'mobile':'desktop'}.png`);
 await page.getByRole('checkbox',{name:'Include scene receipt'}).check();
 const labeled=page.waitForEvent('download');await page.getByRole('button',{name:'Save PNG'}).click();await (await labeled).saveAs(`/private/tmp/she526-receipt-${mobile?'mobile':'desktop'}.png`);
 await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/hbl-photo/);await expect(open).toBeFocused();
 for(let i=0;i<8;i++){await open.click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.keyboard.press('Escape');}
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 await expect(open).toHaveCount(0);await expect(page.locator('[data-photo-panel]')).toHaveCount(0);
});
