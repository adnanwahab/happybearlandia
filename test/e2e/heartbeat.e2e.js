import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const moduleUrl='data:text/javascript;base64,'+Buffer.from(readFileSync(process.cwd()+'/world/heartbeat.js')).toString('base64');
import fixture from '../fixtures/heartbeat/representative.json' with {type:'json'};
test('recorded crest seeks exact clock, gap breaks line, reset clears and disposal removes view',async({page})=>{
 await page.goto('about:blank');
 await page.evaluate(async ({fixture,moduleUrl})=>{
  const {mountHeartbeat}=await import(moduleUrl);
  let runId=fixture.runId;window.heartbeatMinute=null;let listener;
  window.heartbeatTest=mountHeartbeat(document.body,{source:{getSnapshot:()=>({runId}),getHistory:async()=>({...fixture,runId}),subscribe:fn=>{listener=fn;return()=>{listener=null;};}},seek:async minute=>{window.heartbeatMinute=minute;return {minute};}});
  window.resetHeartbeat=()=>{runId='other';listener();};
 },{fixture,moduleUrl});
 await page.locator('#city-heartbeat summary').click();
 await expect(page.locator('#city-heartbeat button[data-minute]')).toHaveCount(3);
 expect(await page.locator('#city-heartbeat path').getAttribute('d')).toMatch(/M.*L.*M/);
 await page.locator('#city-heartbeat button[data-minute="420"]').click();
 await expect(page.locator('#city-heartbeat [role=status]')).toContainText('exact simulation minute 420');
 expect(await page.evaluate(()=>window.heartbeatMinute)).toBe(420);
 expect(await page.locator('#city-heartbeat').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'test-results/heartbeat-mobile.png'});
 await page.evaluate(()=>window.resetHeartbeat());
 await expect(page.locator('#city-heartbeat circle')).toHaveCount(0);
 await page.evaluate(()=>window.heartbeatTest.destroy());
 await expect(page.locator('#city-heartbeat')).toHaveCount(0);
});
