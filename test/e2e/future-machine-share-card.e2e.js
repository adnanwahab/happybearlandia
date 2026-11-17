import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('actual recorded pair downloads deterministic PNG and unchanged control',async({page},info)=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 const button=page.getByRole('button',{name:'Download share card',exact:true});await expect(button).toBeDisabled();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect(button).toBeEnabled({timeout:90000});
 await page.getByTestId('future-machine-timeline').fill('120');await page.getByTestId('future-machine-timeline').dispatchEvent('input');
 async function download(name){const pending=page.waitForEvent('download');await button.click();const file=await pending;expect(file.suggestedFilename()).toBe('future-machine-seed-42-month-120.png');const path=info.outputPath(name);await file.saveAs(path);return readFile(path);}
 const first=await download('paired-card.png'),second=await download('paired-card-repeat.png');expect(first.equals(second)).toBe(true);expect(first.subarray(1,4).toString()).toBe('PNG');
 const card=await page.evaluate(async()=>{const {createShareCard}=await import('/world/future-machine/share/card.js');const h=window.futureMachine.history;const card=createShareCard(h,120);for(const row of card.rows)if(row.plan!==h.plan[120].metrics[row.key]||row.baseline!==h.baseline[120].metrics[row.key])throw Error('Mismatch');return card;});expect(card.rows[0].delta).toBe(24);
 await info.attach('paired-card',{path:info.outputPath('paired-card.png'),contentType:'image/png'});
 const url=await page.evaluate(async()=>{const {createShareURL}=await import('/world/future-machine/share/index.js');return createShareURL({recipe:{...window.futureMachine.history.recipe,intervention:null},month:120},location.origin+location.pathname+'?renderer=canvas2d');});await page.goto(url);await expect(button).toBeEnabled({timeout:90000});
 expect(await page.evaluate(async()=>{const {createShareCard}=await import('/world/future-machine/share/card.js');return createShareCard(window.futureMachine.history,120).comparison;})).toContain('No change');await download('no-change-card.png');
 await page.screenshot({path:info.outputPath('share-card-control.png'),fullPage:true});
});
