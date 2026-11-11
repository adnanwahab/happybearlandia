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
 await scrub.fill('36');await scrub.dispatchEvent('input');
 expect(await scrub.inputValue()).toBe('36');
 await page.locator('#building-play').click();
 await expect(label).toContainText('none through this month');
 await expect(label).toContainText('recession');
 await page.locator('#building-play').click();
 const paused=await scrub.inputValue();await page.waitForTimeout(250);expect(await scrub.inputValue()).toBe(paused);
 await page.getByRole('button',{name:'Enable subtle sound',exact:true}).click();
 const mute=page.getByRole('button',{name:'Mute subtle sound',exact:true});
 if(await mute.count()){await expect(mute).toHaveAttribute('aria-pressed','true');await mute.click();await expect(page.getByRole('button',{name:'Enable subtle sound',exact:true})).toHaveAttribute('aria-pressed','false');}
 else await expect(page.getByRole('button',{name:'Audio unavailable',exact:true})).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});
 await scrub.fill('36');await scrub.dispatchEvent('input');
 await page.locator('#building-play').click();
 await page.locator('#building-reset').click();
 expect(await scrub.inputValue()).toBe('0');
 await page.waitForTimeout(250);expect(await scrub.inputValue()).toBe('0');
 await page.screenshot({path:info.outputPath('recorded-presentation.png')});
 await info.attach('acceptance.json',{body:JSON.stringify({experimentId:experiment.id,seed:42,stressMonth:37,paused,scope:'integer cursor, recorded event boundary, mute/activation, reduced-motion control operation, reset disposal; no rendered fraction or fork acceptance'}),contentType:'application/json'});
 await page.goto('/world/decision.html');
});
