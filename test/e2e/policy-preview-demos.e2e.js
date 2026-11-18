import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const fixture=async id=>JSON.parse(await readFile(new URL(`../../world/policy-preview-demos/${id}.json`,import.meta.url),'utf8'));
test('static normal route retains exact text, and never offers an uncreated fixture link',async({page})=>{
 await page.goto('/world/policy-preview-demos/index.html');await expect(page.locator('article')).toHaveCount(4);await expect(page.getByText('Open verified recorded preview')).toHaveCount(0);
 await page.locator('#receipt').setInputFiles({name:'fake.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:'hbl-demo-local-receipt.v1',demos:[{fixtureId:'housing',previewId:'housing'}]}))});await expect(page.locator('#status')).toContainText('Invalid fixture/preview identity');
 await expect(page.locator('[data-demo=unsupported]')).toContainText('Not Modeled');
});
for(const id of ['housing','drainage','transit'])test(`${id}: real handler creation, catalog import and summary-first viewer of 100 pairs`,async({page,request},info)=>{
 const input=await fixture(id),createdResponse=await request.post('/api/policy-previews',{headers:{authorization:'Bearer demo-browser-local-token'},data:input});expect(createdResponse.status()).toBe(202);const created=await createdResponse.json();
 await expect.poll(async()=>(await(await request.get(`/api/policy-previews/${created.id}`)).json()).job.status,{timeout:180000}).toBe('completed');
 const manifest=await(await request.get(`/api/policy-previews/${created.id}`)).json();
 await page.goto('/world/policy-preview-demos/index.html');await expect(page.locator('article')).toHaveCount(4);
 const receipt={schemaVersion:'hbl-demo-local-receipt.v1',demos:[{fixtureId:id,previewId:created.id,modelVersion:manifest.modelVersion,mappingVersion:manifest.mappingVersion}]};
 await page.locator('#receipt').setInputFiles({name:'created.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(receipt))});await expect(page.locator('#status')).toContainText('identities verified');
 const reads=[];page.on('request',r=>{if(r.url().includes('/api/policy-previews/'))reads.push(r.url());});
 await page.getByText('Open verified recorded preview').click();await expect(page.locator('#landscape circle')).toHaveCount(100);await expect(page.locator('#load-status')).toHaveText('Recorded checkpoint loaded.');
 for(const [index,month] of [0,12,24].entries()){
  await page.evaluate(i=>window.hblPolicyImpact.selectCheckpoint(i),index);await expect(page.locator('#month-label')).toHaveText(`Month ${month}`);
  expect(await page.evaluate(()=>{const s=window.hblPolicyImpact.getState(),p=s.results.runs.find(p=>p.runIndex===s.runIndex);return ['baseline','proposal'].every(a=>JSON.stringify(s.selected[a])===JSON.stringify(p[a].checkpoints.find(c=>c.month===s.month).state));})).toBe(true);
 }
 expect(reads.some(u=>u.includes('/summary?'))).toBe(true);expect(reads.some(u=>/\/results$/.test(u))).toBe(false);
 await page.locator('#landscape [data-run-index="99"]').click();await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact.getState().runIndex)).toBe(99);
 await page.reload();await expect(page.locator('#selection')).toContainText('pair 100');await expect(page.locator('#month-label')).toHaveText('Month 24');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:info.outputPath(`${id}-desktop.png`)});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`${id}-mobile.png`)});
});
