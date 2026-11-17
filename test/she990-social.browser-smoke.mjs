// Actual canonical World social integration; no actor/command fixtures.
import {chromium, expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const artifacts=process.env.HBL_BROWSER_ARTIFACT_DIR||'/private/tmp/she990-main-evidence';
const baseURL=process.env.HBL_BROWSER_BASE_URL||'http://127.0.0.1:43943';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal','--enable-unsafe-webgpu']});
const report={errors:[],gpuErrors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/webgpu|GPUValidation|device.?lost/i.test(m.text()))report.gpuErrors.push(m.text());});
 await page.goto(`${baseURL}/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline`);
 await page.waitForFunction(()=>window.hblPersonCommands&&window.hblWorldStartup?.readyMs,{timeout:90000});
 expect(await page.evaluate(()=>hblCityRenderer.getPerformanceStats().backend)).toBe('webgpu');
 await page.locator('[data-launch=pause]').click();
 expect(await page.evaluate(()=>hblSimulationPlayback.getState().paused)).toBe(true);
 report.state=await page.evaluate(()=>hblSessionLogState());
 await page.locator('[data-launch=people]').click();
 await page.locator('.launch-person-list button').first().click();
 report.actor=await page.evaluate(()=>hblPersonCommands.getActor());
 report.socialBefore=await page.locator('#inspect').innerText();
 await page.getByRole('button',{name:'Social…',exact:true}).click();
 const dialog=page.locator('.person-context-menu');
 const target=page.getByRole('combobox',{name:'Nearby resident'});
 await expect(target).toBeVisible();report.target=await target.inputValue();
 await dialog.getByRole('button',{name:'Talk',exact:true}).click();
 await expect(dialog.getByRole('status')).not.toContainText(/Choose someone|Finding nearby/);
 const ledger=`Ledger ID: ${JSON.stringify([String(report.actor.id),report.target].sort())}`;
 await expect(page.locator('#inspect')).toContainText(ledger);
 report.actorAfter=await page.evaluate(()=>hblPersonCommands.getActor());
 expect(report.actorAfter.needs.social).toBeCloseTo(Math.min(100,report.actor.needs.social+8),6);
 report.socialAfter=await dialog.innerText();
 report.inspector=await page.locator('#inspect').innerText();
 await page.screenshot({path:join(artifacts,'desktop-social.png')});
 expect(report.errors).toEqual([]);expect(report.gpuErrors).toEqual([]);
 console.log('Actual World Social → Talk: passed, authoritative outcome and ledger confirmed.');
}finally{
 await writeFile(join(artifacts,'social.json'),JSON.stringify(report,null,2));
 await browser.close();
}
