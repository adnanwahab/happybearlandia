import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){await page.getByRole('slider').fill(String(month));await page.getByRole('slider').dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}
async function identity(page){return page.evaluate(async()=>{
 const h=window.futureMachine.history,s=window.futureMachine.state;
 const {stateHash}=await import('/world/future-machine/data/core.js');
 return {id:h.experimentId,recipe:h.recipe,initialHash:h.initialHash,baselineHash:await stateHash(h.baseline),commonInitial:JSON.stringify(h.baseline[0])===JSON.stringify(h.plan[0]),lengths:[h.baseline.length,h.plan.length],month:s.month,demo:s.demo?.status??'idle',homes:h.plan[120].metrics.housingUnits-h.baseline[120].metrics.housingUnits,backend:window.futureMachine.stats.scene.backend};
 });}

// Only latency is injected. Every held response is fetched from the actual City
// API, after its real worker has completed replay; no state or metric is replaced.
async function holdNextReplay(page){
 let release,entered,settled,held=false;
 const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>entered=resolve),done=new Promise(resolve=>settled=resolve);
 const pattern='**/api/city-experiments/*/replay';
 const handler=async route=>{
  if(held)return route.continue();held=true;
  try{const response=await route.fetch();entered({url:route.request().url(),scenario:route.request().postDataJSON().scenarioId,status:response.status()});await gate;
   try{await route.fulfill({response});}catch(error){if(!/cancel|abort|closed|Invalid Interception/i.test(error.message))throw error;}
  }finally{settled();}
 };
 await page.route(pattern,handler);
 return {seen,async release(){release();await done;await page.unroute(pattern,handler);}};
}

test('cancel/restart keeps latest actual pair and blocks stale demo continuation',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const original=await identity(page);expect(original.homes).toBe(24);expect(original.commonInitial).toBe(true);expect(original.backend).toBe('canvas2d');
 const evidence=[];
 // First establish a zero-control pair so Play Demo must compute the default.
 await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('baseline');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 expect((await identity(page)).homes).toBe(0);
 for(const restartWithPlan of [false,true]){
  const gate=await holdNextReplay(page);
  try{
   if(!restartWithPlan)await page.getByRole('button',{name:'Play Demo',exact:true}).click();
   else{await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('baseline');await page.getByRole('button',{name:'Fork City',exact:true}).click();}
   const held=await gate.seen;expect(held.status).toBe(200);expect(held.scenario).toBe('baseline');
   await expect(page.getByRole('button',{name:'Cancel run',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Cancel run',exact:true}).click();
   await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
   // Cancellation retains the previous comparison for exploration.
   expect((await identity(page)).baselineHash).toBe(original.baselineHash);
   await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption(restartWithPlan?'housing':'baseline');
   if(restartWithPlan)await page.getByRole('spinbutton',{name:'Proposed homes for next run'}).fill('12');
   await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,37);
   const latest=await identity(page);expect(latest.id).not.toBe(held.url.split('/').at(-2));
   expect(latest.recipe.intervention===null).toBe(!restartWithPlan);expect(latest.homes).toBe(restartWithPlan?12:0);
   expect(latest.baselineHash).toBe(original.baselineHash);expect(latest.initialHash).toBe(original.initialHash);expect(latest.commonInitial).toBe(true);expect(latest.lengths).toEqual([121,121]);
   await gate.release();
   // A stale demo would restart its presentation clock, then advance after 4s.
   await page.waitForTimeout(4600);
   const after=await identity(page);expect(after).toEqual(latest);expect(after.demo).not.toBe('playing');
   evidence.push({restartWithPlan,held,latest,after});
  }finally{await gate.release();}
 }
 const evidencePath=testInfo.outputPath('actual-cancel-restart-evidence.json');
 await writeFile(evidencePath,JSON.stringify({original,races:evidence},null,2));
 await testInfo.attach('actual-cancel-restart-evidence',{path:evidencePath,contentType:'application/json'});
 console.log('RACE_EVIDENCE',evidencePath);
 expect(errors).toEqual([]);
});
