import {test,expect} from '@playwright/test';
import {policyHash} from '../../world/policy-preview-contract.js';
import {readFile} from 'node:fs/promises';

const token='policy-impact-browser-test-token';
const input={schemaVersion:'policy-impact-preview.v1',source:{system:'civic-synthesis',proposalId:'browser-housing',versionId:'v1',contentHash:'a'.repeat(64),type:'bill',title:'Synthetic housing proposal',url:'https://civic-synthesis.example/proposals/browser-housing',visibility:'public'},legal:{baseVersionId:'v0',clauses:[{clauseId:'housing-1',sourcePolicyId:'h_lots',operation:'add',beforeText:'',afterText:'Allow additional homes on eligible modeled parcels.'},{clauseId:'health-1',sourcePolicyId:'unknown-health',operation:'add',beforeText:'',afterText:'Provide universal access to healthcare.'}]},baseline:{kind:'prior-proposal-version',versionId:'v0',label:'Prior proposal version'},simulation:{seed:42,runs:3,months:24}};
input.source.contentHash=policyHash(input.legal);
test('public frozen preview connects legal changes, recorded city pairs, timeline and explanations',async({page,request})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const created=await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:input});expect(created.status()).toBe(202);const preview=await created.json();expect(preview.id).toBeTruthy();
 await page.goto(`/world/impact?preview=${preview.id}`);await expect(page.locator('#proposal-title')).toHaveText(input.source.title);await expect(page.locator('.added').first()).toHaveText('+ '+input.legal.clauses[0].afterText);await expect(page.locator('.disclosure')).toContainText('Synthetic');
 await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact?.getState().selected?.proposal?.month),{timeout:90000}).toBe(0);
 await expect(page.locator('#city-a canvas')).toBeVisible();await expect(page.locator('#city-b canvas')).toBeVisible();await expect(page.locator('#landscape circle')).toHaveCount(3);
 await page.locator('#month').focus();await page.locator('#month').press('End');await expect(page.locator('#month-label')).toHaveText('Month 24');
 const selected=await page.evaluate(()=>{const state=window.hblPolicyImpact.getState();const run=state.results.runs.find(row=>row.runIndex===state.runIndex);return{month:state.month,a:state.selected.baseline.month,b:state.selected.proposal.month,metric:state.analysis.scorecard.find(row=>row.id==='housingUnits'),recorded:run.proposal.metricsTimeline.find(point=>point.month===state.month).metrics.housingUnits,stats:state.views.map(view=>view.getStats()),cameras:state.views.map(view=>view.getCamera())};});expect(selected.a).toBe(24);expect(selected.b).toBe(24);expect(selected.metric.current).toBe(selected.recorded);expect(selected.cameras[0]).toEqual(selected.cameras[1]);
 await page.locator('#landscape circle').last().click();await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact.getState().runIndex)).toBe(2);await expect(page.locator('#month-label')).toHaveText('Month 24');
 await page.locator('[data-clause="health-1"] button').click();await expect(page.locator('#mapping')).toContainText(/unchanged|unavailable|unsupported/i);await page.locator('#graph [role=button]').first().click();await expect(page.locator('#node-detail')).toContainText('health-1');await expect(page.locator('#node-detail')).toContainText('mappingBoundary');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1400,height:1000});await page.screenshot({path:test.info().outputPath('policy-impact-desktop.png'),fullPage:true});expect(errors).toEqual([]);
});
test('unavailable preview is explicit',async({page})=>{await page.goto('/world/impact?preview=missing');await expect(page.locator('#status')).toContainText('unavailable');await expect(page.locator('#explorer')).toBeHidden();});

test('100 actual paired futures remain individually selectable without overlapping dots',async({page,request})=>{
 test.setTimeout(180000);
 const fixture=JSON.parse(await readFile(new URL('../../world/policy-preview-demo.json',import.meta.url),'utf8'));
 const created=await request.post('/api/policy-previews',{headers:{authorization:`Bearer ${token}`},data:fixture});expect([200,202]).toContain(created.status());const preview=await created.json();
 await expect.poll(async()=>{const response=await request.get(`/api/policy-previews/${preview.id}`);return (await response.json()).job;},{timeout:150000,intervals:[1000,2000]}).toMatchObject({status:'completed',completed:100,failed:0,total:100});
 await page.goto(`/world/impact?preview=${preview.id}`);await expect(page.locator('#landscape circle')).toHaveCount(100,{timeout:60000});
 // At month0 many identical outcomes must retain distinct positions.
 const dots=await page.locator('#landscape circle').evaluateAll(nodes=>nodes.map(node=>[Number(node.getAttribute('cx')),Number(node.getAttribute('cy'))]));
 expect(new Set(dots.map(point=>point.join(','))).size).toBe(100);
 for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++)expect(Math.hypot(dots[i][0]-dots[j][0],dots[i][1]-dots[j][1])).toBeGreaterThanOrEqual(12);
 await page.locator('#month').focus();await page.locator('#month').press('End');await expect(page.locator('#month-label')).toHaveText('Month 24');await expect(page.locator('#landscape circle')).toHaveCount(100);
 await page.locator('#landscape [data-run-index="99"]').click();await expect.poll(()=>page.evaluate(()=>window.hblPolicyImpact.getState().runIndex)).toBe(99);await expect(page.locator('#selection')).toContainText('pair 100');await expect(page.locator('#month-label')).toHaveText('Month 24');
 const recorded=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState();return {month:s.selected.proposal.month,seed:s.selected.proposal.seed,pairSeed:s.results.runs.find(row=>row.runIndex===99).seed};});expect(recorded.month).toBe(24);expect(recorded.seed).toBe(recorded.pairSeed);
 await page.setViewportSize({width:1400,height:1000});await page.locator('#landscape').evaluate(node=>{node.scrollTop=0;});await page.screenshot({path:test.info().outputPath('policy-impact-100-futures.png'),fullPage:true});
});
