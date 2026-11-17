import {test,expect} from '@playwright/test';
import {buildTown} from '../../world/gen.js';
import {createWorld} from '../../world/sim.js';
import {captureLegacyCheckpoint} from '../../world/legacy-checkpoint.js';
test('normal World notes: unavailable, literal text, reload, export/import, delete and keyboard access',async({page},testInfo)=>{
 const world=createWorld(buildTown({lat:35,lng:139},null,{maxPeople:4}),{recordHistory:true,startMinute:420});
 const record={id:'Private00001',save:{schemaVersion:'world-experiment-save.v1',mode:'legacy',checkpoint:captureLegacyCheckpoint(world),view:{}}};
 await page.route('**/api/world-experiments/Private00001',route=>route.fulfill({json:record}));
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 await page.getByRole('button',{name:'Saved experiments',exact:true}).click();
 const notes=page.locator('.private-notes');
 await notes.getByRole('button',{name:'Load notes for saved checkpoint'}).click();
 await expect(notes.getByRole('status')).toContainText('Save an experiment first');
 // Disposable existing-save fixture through the production panel entry point.
 await page.evaluate(async()=>{window.hblWorldPersistence.destroy();const {mountWorldPersistence}=await import('/world/experiments/persistence-panel.js');window.hblWorldPersistence=mountWorldPersistence({container:document.querySelector('#top'),currentId:'Private00001',capture:async()=>{throw Error('No server writes in this fixture');}});});
 await page.getByRole('button',{name:'Saved experiments',exact:true}).click();
 await notes.getByRole('button',{name:'Load notes for saved checkpoint'}).click();
 await expect(notes.getByRole('status')).toContainText('Exact saved checkpoint ready');
 const text='<img src=x onerror=alert(1)> private discovery';
 await notes.getByLabel('Your note').fill(text);
 await notes.getByRole('button',{name:'Save private note',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(notes.locator('li p')).toHaveText(text);await expect(notes.locator('li img')).toHaveCount(0);
 const downloadPromise=page.waitForEvent('download');await notes.getByRole('button',{name:'Export all notes'}).click();const download=await downloadPromise;const path=await download.path();
 await notes.getByRole('button',{name:'Delete note',exact:true}).click();await expect(notes.locator('ul')).toHaveText('No private notes yet.');
 await notes.getByLabel('Import notes JSON').setInputFiles(path);await expect(notes.locator('li p')).toHaveText(text);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-581-after-'+testInfo.project.name+'.png',fullPage:true});
 await notes.getByLabel('Import notes JSON').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(notes.getByRole('status')).toContainText('Unsupported');await expect(notes.locator('li p')).toHaveText(text);
 page.once('dialog',d=>d.accept());await notes.getByRole('button',{name:'Delete all private notes'}).click();await expect(notes.locator('ul')).toHaveText('No private notes yet.');
});
