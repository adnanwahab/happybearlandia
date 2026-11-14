import {test,expect} from '@playwright/test';
const route='/world/?demo=1&synthetic=1&people=20&renderer=webgl';
async function controls(page){if(!await page.locator('#runCycleBtn').isVisible())await page.getByText('World controls',{exact:true}).click();await expect(page.locator('#runCycleBtn')).toBeVisible();}
async function ready(page){
 await page.goto(route);
 await page.waitForFunction(()=>window.hblGuidedActions,{timeout:60000});
 await controls(page);
}
test('real weekly worker completes twice with identical matched results when map services fail',async({page},testInfo)=>{
 await page.route('**/api/area*',route=>route.abort());
 await page.addInitScript(()=>{
  window.cycleReceipts=[];const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);if(String(url).includes('cycle.worker.js'))this.addEventListener('message',e=>{if(e.data?.type==='done')window.cycleReceipts.push(e.data.result);});}};
 });
 await ready(page);
 await page.locator('#runCycleBtn').click();
 await expect(page.locator('#cycleRunState')).toHaveText('Completed',{timeout:120000});
 await controls(page);await page.locator('#runCycleBtn').click();
 await expect(page.locator('#cycleRunState')).toHaveText('Completed',{timeout:120000});
 const receipts=await page.evaluate(()=>window.cycleReceipts);
 expect(receipts).toHaveLength(2);expect(receipts[1]).toEqual(receipts[0]);
 await page.screenshot({path:testInfo.outputPath('completed-week.png')});
});
test('native worker load failure becomes retryable and the retry really completes',async({page})=>{
 await page.route('**/world/cycle.worker.js',route=>route.abort());await ready(page);
 await page.locator('#runCycleBtn').click();
 await expect(page.locator('#cycleRunState')).toHaveText('Failed');
 await expect(page.locator('#runCycleBtn')).toBeEnabled();
 await page.unroute('**/world/cycle.worker.js');await controls(page);await page.locator('#runCycleBtn').click();
 await expect(page.locator('#cycleRunState')).toHaveText('Completed',{timeout:120000});
});
test('a silent worker can be cancelled and releases the Run action',async({page})=>{
 await page.route('**/world/cycle.worker.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{};'}));
 await ready(page);await page.locator('#runCycleBtn').click();await expect(page.locator('#cycleRunState')).toHaveText('Running');
 await page.locator('#cycleCancel').click();await expect(page.locator('#cycleRunState')).toHaveText('Cancelled');
 await expect(page.locator('#runCycleBtn')).toBeEnabled();await expect(page.locator('#cycleProgress')).toBeHidden();
});
test('the bounded deadline fails a silent worker and enables retry',async({page})=>{
 await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===120000?100:ms,...args);});
 await page.route('**/world/cycle.worker.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{};'}));
 await ready(page);await page.locator('#runCycleBtn').click();await expect(page.locator('#cycleRunState')).toHaveText('Failed');
 await expect(page.locator('#cycleStatus')).toContainText('120-second limit');await expect(page.locator('#runCycleBtn')).toBeEnabled();
});
