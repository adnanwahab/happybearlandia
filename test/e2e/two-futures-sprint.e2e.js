import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

const route='/world/future-machine.html';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){const slider=page.getByRole('slider').first();await slider.fill(String(month));await slider.dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}
async function fork(page){await page.goto(route);await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);}
async function evidence(page,testInfo,name){
 const record=await page.evaluate(()=>{const api=window.futureMachine,h=api.history,s=api.state,m=s.month;return {schemaVersion:'two-futures-browser-evidence.v1',selectedMonth:m,seed:h.seed,modelVersion:h.modelVersion,experimentId:h.experimentId,initialHash:h.initialHash,scenario:h.recipe,provenance:h.provenance,baseline:h.baseline[m],plan:h.plan[m],diff:s.diff,scene:api.stats.scene,camera:api.stats.scene?.camera??null};});
 await writeFile(testInfo.outputPath(`${name}.json`),JSON.stringify(record,null,2));await page.screenshot({path:testInfo.outputPath(`${name}.png`),fullPage:true});return record;
}
function assertPair(record){expect(record.seed).toBe(42);expect(record.modelVersion).toBeTruthy();expect(record.experimentId).toBeTruthy();expect(record.initialHash).toBeTruthy();expect(record.scenario.intervention).toMatchObject({type:'housing',amount:24,cost:1000000,delay:0});expect(record.baseline.month).toBe(record.selectedMonth);expect(record.plan.month).toBe(record.selectedMonth);}

test('real paired runs: matched start, physical divergence, metrics, timeline and deterministic refresh',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await fork(page);
 const start=await evidence(page,testInfo,'before-month-0');assertPair(start);expect(start.baseline.state).toEqual(start.plan.state);expect(start.diff.physicalCount).toBe(0);
 await seek(page,120);const end=await evidence(page,testInfo,'after-month-120');assertPair(end);expect(end.diff.physicalCount).toBeGreaterThan(0);expect(end.diff.metrics.housingUnits.delta).toBe(24);expect(end.diff.metrics.capitalSpending.delta).toBe(1000000);
 expect(Object.values(end.diff.metrics).filter(m=>Number.isFinite(m.delta)&&m.delta!==0).length).toBeGreaterThanOrEqual(2);
 await expect(page.getByRole('region',{name:'Measured outcomes'})).toContainText('24');
 await page.getByRole('button',{name:/building-d1.*schematic/}).last().click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-d1');
 await page.reload();await ready(page);expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(120);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics)).toEqual(end.diff.metrics);
 // A second real run verifies reproducibility independently of the saved replay URL.
 await fork(page);await seek(page,120);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics)).toEqual(end.diff.metrics);expect(await page.evaluate(()=>window.futureMachine.history.initialHash)).toBe(end.initialHash);expect(errors).toEqual([]);
});

test('guided controls, shared camera, difference-only and metric WHY',async({page},testInfo)=>{
 await page.goto(route);await page.getByRole('button',{name:/^Play Demo$/i}).click();await ready(page);
 const pause=page.getByRole('button',{name:/pause.*demo/i});await pause.click();const paused=await page.evaluate(()=>window.futureMachine.state.month);await page.waitForTimeout(800);expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(paused);
 await page.getByRole('button',{name:/resume.*demo/i}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month),{timeout:15000}).toBeGreaterThan(paused);await page.getByRole('button',{name:/pause.*demo/i}).click();
 await seek(page,120);const canvas=page.locator('canvas').first();await expect(canvas).toBeVisible();
 const camera=await page.evaluate(()=>window.futureMachine.stats.scene.camera);expect(camera,'Scene diagnostics must expose the actual shared camera').toBeTruthy();
 const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.25+70,box.y+box.height*.5+15,{steps:8});await page.mouse.up();
 const moved=await page.evaluate(()=>window.futureMachine.stats.scene.camera);expect(moved).not.toEqual(camera);
 await page.getByRole('button',{name:/difference.?only/i}).click();expect(await page.evaluate(()=>window.futureMachine.stats.scene.camera)).toEqual(moved);
 await page.getByRole('button',{name:/side by side|split view/i}).click();expect(await page.evaluate(()=>window.futureMachine.stats.scene.camera)).toEqual(moved);
 await page.getByRole('button',{name:/why.*homes|homes.*why/i}).click();const story=page.getByRole('region',{name:'Recorded change story'});await expect(story).toContainText(/120/);await expect(story).toContainText(/42/);await expect(story).toContainText(/housing/i);await expect(story).toContainText(/synthetic|uncalibrated/i);await expect(story).toContainText(await page.evaluate(()=>window.futureMachine.history.modelVersion));await expect(story).toContainText(await page.evaluate(()=>window.futureMachine.history.experimentId));await evidence(page,testInfo,'interactive-why-month-120');
});

test('forced unavailable WebGL retains actual paired evidence and selection',async({page},testInfo)=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});await fork(page);await seek(page,120);await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('inventory-fallback');await page.getByRole('button',{name:/building-d1.*schematic/}).last().click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-d1');const record=await evidence(page,testInfo,'webgl-unavailable');expect(record.diff.metrics.housingUnits.delta).toBe(24);
});

test('record real 45–60 second one-click Play Demo',async({page},testInfo)=>{
 test.skip(!process.env.HBL_RECORD_DEMO,'Enable HBL_RECORD_DEMO=1 for real-time video evidence.');
 await page.goto(route);const started=Date.now();await page.getByRole('button',{name:/^Play Demo$/i}).click();await ready(page);await evidence(page,testInfo,'demo-start');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month),{timeout:65000,intervals:[500]}).toBe(120);
 const elapsedMs=Date.now()-started;expect(elapsedMs).toBeGreaterThanOrEqual(45000);expect(elapsedMs).toBeLessThanOrEqual(60000);const end=await evidence(page,testInfo,'demo-complete');expect(end.diff.metrics.housingUnits.delta).toBe(24);await writeFile(testInfo.outputPath('demo-timing.json'),JSON.stringify({elapsedMs,seed:end.seed,scenario:end.scenario,selectedMonth:end.selectedMonth},null,2));
});
