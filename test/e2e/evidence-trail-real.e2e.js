import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const building='building-project-policy-1-0';
async function seek(page,month){await page.getByTestId('future-machine-timeline').fill(String(month));await page.getByTestId('future-machine-timeline').dispatchEvent('input');await synchronized(page,month);}
async function synchronized(page,month){await expect.poll(()=>page.evaluate(()=>({month:window.futureMachine.state.month,a:window.futureMachine.state.frame?.baseline.month,b:window.futureMachine.state.frame?.plan.month,scene:window.futureMachine.stats.scene.month}))).toEqual({month,a:month,b:month,scene:month});}
async function selectAdded(page){await seek(page,120);await page.getByRole('button',{name:new RegExp(`${building} · schematic`)}).last().click();}
test('real housing trail jumps to exact recorded policy, project and completion months',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');await selectAdded(page);
 const trail=page.getByRole('region',{name:'Visual WHY evidence trail'});
 await expect(trail).toContainText('WITHOUT PLAN');await expect(trail).toContainText('Building is absent at the selected recorded month.');
 await expect(trail.getByRole('button',{name:'housing-units · Month 16 · event 16-0 · 24 homes',exact:true})).toBeVisible();
 await trail.getByText('Recorded links and unavailable dependencies',{exact:true}).click();await expect(trail).toContainText('independent causal dependency trace · unavailable');
 const evidence=await page.evaluate(async()=>{const h=window.futureMachine.history;const {stateHash}=await import('/world/future-machine/data/core.js');const {buildEvidenceTrail}=await import('/world/future-machine/story/evidence-trail.js');return {experimentId:h.experimentId,seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,baselineHash:await stateHash(h.baseline),trail:buildEvidenceTrail(h,{collection:'buildings',id:'building-project-policy-1-0',month:120}),metrics:window.futureMachine.state.diff.metrics,completion:h.plan[16].events.find(e=>e.id==='16-0')};});
 expect(evidence.seed).toBe(42);expect(evidence.metrics.housingUnits.delta).toBe(24);expect(evidence.metrics.capitalSpending.delta).toBe(1000000);expect(evidence.completion).toMatchObject({simulationTime:16,eventType:'PROJECT_COMPLETE',payload:{units:24,projectId:'project-policy-1-0'}});
 await trail.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('evidence-trail-month120.png'),fullPage:true});
 await trail.getByRole('button',{name:'completion · Month 16 · event 16-0',exact:true}).click();await synchronized(page,16);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText(building);
 await page.screenshot({path:testInfo.outputPath('evidence-trail-completion-month16.png'),fullPage:true});
 await selectAdded(page);await trail.getByRole('button',{name:'policy · Month 1',exact:true}).click();await synchronized(page,1);
 await selectAdded(page);await trail.getByRole('button',{name:'project · Month 3',exact:true}).click();await synchronized(page,3);
 await selectAdded(page);await seek(page,0);
 expect(await page.evaluate(()=>window.futureMachine.state.frame.plan.state.buildings.some(b=>b.id==='building-project-policy-1-0'))).toBe(false);
 const staleTrailAfterScrub=await trail.innerText();
 await page.screenshot({path:testInfo.outputPath('evidence-trail-scrub-zero-before-reselection.png'),fullPage:true});
 // A fresh initial-state selection must not expose the future completion.
 await page.getByRole('button',{name:/building-d1 · schematic/}).last().click();await expect(trail.getByRole('button',{name:/completion.*16-0/})).toHaveCount(0);
 const noFuture=await page.evaluate(async()=>{const {buildEvidenceTrail}=await import('/world/future-machine/story/evidence-trail.js');return buildEvidenceTrail(window.futureMachine.history,{collection:'buildings',id:'building-project-policy-1-0',month:0});});
 expect(noFuture.edges).toEqual([]);expect(noFuture.nodes.every(n=>n.status==='unavailable'&&n.type==='building')).toBe(true);
 const after=await page.evaluate(async()=>{const {stateHash}=await import('/world/future-machine/data/core.js');return stateHash(window.futureMachine.history.baseline);});expect(after).toBe(evidence.baselineHash);
 const path=testInfo.outputPath('evidence-trail-real.json');await writeFile(path,JSON.stringify({...evidence,noFuture,staleTrailAfterScrub},null,2));await testInfo.attach('exact-evidence-trail',{path,contentType:'application/json'});console.log('TRAIL_EVIDENCE',path);expect(errors).toEqual([]);
});
