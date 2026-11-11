import {test,expect} from '@playwright/test';
import {housingModel,createHousingScenarios} from '../../world/models/housing/index.js';
import {createBuildingProposal} from '../../world/buildings/proposal.js';

// Acceptance contract for the coordinator's real studio mount. Never injects UI/model doubles.
test('recorded presentation through Decision Studio production route',async({page,request},info)=>{
 const scenarios=createHousingScenarios();const scenario=scenarios.find(s=>s.id==='plan-a');
 scenario.projects=[createBuildingProposal({id:'presentation-browser-project',status:'approved'})];
 scenario.scheduledStress=[{presetId:'recession',startMonth:37}];
 const response=await request.post('/api/decision-experiments',{data:{schemaVersion:'decision-experiment.v1',name:'Presentation acceptance',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:1,years:10,scenarios,metadata:{test:'presentation-effects'}}});
 expect(response.status()).toBe(201);const {experiment}=await response.json();
 expect((await request.post(`/api/decision-experiments/${experiment.id}/start`)).ok()).toBe(true);
 await expect.poll(async()=> (await(await request.get(`/api/decision-experiments/${experiment.id}`)).json()).experiment.status).toBe('completed');
 await page.goto(`/world/decision.html?experiment=${experiment.id}`);
 await expect(page.locator('#building-month')).toBeVisible();
 const label=page.locator('p').filter({hasText:/Visual interpolation/}).first();
 await expect(label).toBeVisible();
 await page.locator('#building-scenario').selectOption('plan-a');
 const scrub=page.locator('#building-month');
 await scrub.fill('36.5');await scrub.dispatchEvent('input');
 expect(await scrub.inputValue()).toBe('36.5');
 await expect(label).not.toContainText('recession');
 await page.locator('#building-play').click();
 await expect(label).toContainText('recession');
 await page.locator('#building-play').click();
 const paused=await scrub.inputValue();await page.waitForTimeout(250);expect(await scrub.inputValue()).toBe(paused);
 await page.getByRole('button',{name:'Enable subtle sound',exact:true}).click();
 const mute=page.getByRole('button',{name:'Mute subtle sound',exact:true});
 if(await mute.count()){await expect(mute).toHaveAttribute('aria-pressed','true');await mute.click();await expect(page.getByRole('button',{name:'Enable subtle sound',exact:true})).toHaveAttribute('aria-pressed','false');}
 else await expect(page.getByRole('button',{name:'Audio unavailable',exact:true})).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});
 await scrub.fill('36.5');await scrub.dispatchEvent('input');
 await page.locator('#building-play').click();
 await page.locator('#building-reset').click();
 expect(await scrub.inputValue()).toBe('0');
 await page.waitForTimeout(250);expect(await scrub.inputValue()).toBe('0');
 await page.screenshot({path:info.outputPath('recorded-presentation.png')});
 await info.attach('acceptance.json',{body:JSON.stringify({experimentId:experiment.id,seed:42,stressMonth:37,paused,scope:'integer cursor, recorded event boundary, mute/activation, reduced-motion control operation, reset disposal; no rendered fraction or fork acceptance'}),contentType:'application/json'});
 await page.goto('/world/decision.html');
});

import {hashWorldEditProposal} from '../../world/ai/revisions.js';
test('saved Housing fork preserves prefix and renders recorded divergence with cancellation',async({page,request},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const scenario=createHousingScenarios().find(s=>s.id==='plan-a');scenario.uncertainty={};
 scenario.projects=[createBuildingProposal({id:'fork-browser-project',status:'approved',program:{residentialUnits:10000},geometry:{footprintSqFt:200000}})];
 const created=await request.post('/api/decision-experiments',{data:{schemaVersion:'decision-experiment.v1',name:'Recorded fork browser',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:1,years:10,scenarios:[{...scenario,kind:'baseline'}]}});
 expect(created.status()).toBe(201);const {experiment}=await created.json();await request.post(`/api/decision-experiments/${experiment.id}/start`);
 await expect.poll(async()=>(await(await request.get(`/api/decision-experiments/${experiment.id}`)).json()).experiment.status).toBe('completed');
 const results=await(await request.get(`/api/decision-experiments/${experiment.id}/results`)).json();const source=results.runs[0];
 const proposal={runId:source.id,month:5,operations:[{op:'set_parameter',target:'construction_capacity',value:1000}]};
 const preview=await request.post(`/api/decision-experiments/${experiment.id}/forks`,{data:proposal});expect(preview.ok()).toBe(true);
 const saved=await request.post(`/api/decision-experiments/${experiment.id}/forks`,{data:{...proposal,approval:true,previewHash:await hashWorldEditProposal(proposal)}});const fork=await saved.json();expect(saved.ok(),JSON.stringify(fork)).toBe(true);
 await info.attach('fork-api-provenance.json',{body:JSON.stringify({sourceExperiment:experiment.id,sourceRun:source.id,sourceSeed:source.seed,fork}),contentType:'application/json'});
 await page.goto(`/world/decision.html?experiment=${fork.experiment.id}`);
 await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
 const panel=page.getByRole('region',{name:'Recorded fork timeline'}),scrub=page.locator('#building-month');
 async function at(month){await scrub.fill(String(month));await scrub.dispatchEvent('input');await page.locator('#building-play').click();await expect(panel.locator('pre')).toBeVisible();return JSON.parse(await panel.locator('pre').innerText())}
 for(const month of [4,5]){const data=await at(month);expect(data.original.runId).toBe(source.id);expect(data.original.recorded).toEqual(data.fork.recorded);await expect(panel).toContainText('fixed original prefix');}
 const sourceTrace=await(await request.get(`/api/decision-experiments/${experiment.id}/runs/${source.id}`)).json();const forkTrace=await(await request.get(`/api/decision-experiments/${fork.experiment.id}/runs/${fork.run.id}`)).json();const divergence=sourceTrace.run.projects[0].states.find(s=>s.month>5&&s.floorsBuilt!==forkTrace.run.projects[0].states.find(t=>t.month===s.month)?.floorsBuilt);expect(divergence).toBeTruthy();const data=await at(divergence.month);expect(data.original.recorded.floorsBuilt).not.toBe(data.fork.recorded.floorsBuilt);await expect(panel).toContainText('recorded branch suffix');
 const svg=panel.getByRole('img',{name:'Original and fork recorded construction'});await expect(svg).toHaveAttribute('viewBox','0 0 420 140');
 await panel.screenshot({path:info.outputPath('recorded-fork-divergence.png')});
 const reverse=await at(4);expect(reverse.original.recorded).toEqual(reverse.fork.recorded);
 await scrub.fill('0');await scrub.dispatchEvent('input');await expect(panel).toBeEmpty();await page.clock.runFor(200);await expect(panel).toBeEmpty();
 // Real parent fetch failure, not fabricated model/lineage data.
 await page.route(`**/api/decision-experiments/${experiment.id}/runs/**`,route=>route.abort('failed'));
 await page.locator('#building-play').click();await expect(panel).toContainText('unavailable');
 expect(errors).toEqual([]);
});
