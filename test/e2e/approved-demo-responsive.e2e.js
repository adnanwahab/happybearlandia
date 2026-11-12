import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

async function seek(page,month){
 const slider=page.getByTestId('future-machine-timeline');
 await slider.fill(String(month));await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
}
async function reachable(control){
 await control.scrollIntoViewIfNeeded();await expect(control).toBeVisible();await expect(control).toBeEnabled();
 // Actionability checks detect controls obscured by fixed navigation or sheets.
 await control.click({trial:true});await control.focus();await expect(control).toBeFocused();
}
async function snapshot(page,info,name,errors){
 const state=await page.evaluate(async()=>{
  const api=window.futureMachine,h=api.history,s=api.state;
  const {firstDivergence:find,compareHistory}=await import('/world/future-machine/diff/index.js');
  const stop=find(h,compareHistory(h));const firstDivergence=stop?{month:stop.month,...stop.entity,building:h.plan[stop.month].state.buildings.find(row=>row.id===stop.entity.id)}:null;
  return {schemaVersion:'approved-demo-responsive.v1',recipe:h.recipe,seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,runId:h.experimentId,month:s.month,firstDivergence,metrics:s.diff.metrics,scene:api.stats.scene,baselineBuildings:h.baseline[s.month].state.buildings,planBuildings:h.plan[s.month].state.buildings,evidence:h.plan.slice(0,s.month+1).flatMap(snapshot=>snapshot.events.map(event=>({arm:'plan',snapshotMonth:snapshot.month,...event}))),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 await writeFile(info.outputPath(`${name}.json`),JSON.stringify({...state,errors},null,2));
 await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true});
 expect(state.overflow).toBe(false);expect(state.reducedMotion).toBe(true);expect(state.scene.backend).toBe('canvas2d');return state;
}

for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:640}]){
 test(`homepage Canvas reduced-motion journey at ${viewport.width}px`,async({page,browserName},info)=>{
  const errors={page:[],console:[]};
  page.on('pageerror',e=>errors.page.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text());});
  await page.setViewportSize(viewport);
  // Configure the supported renderer query before application modules execute
  // after the real homepage click. Simulation APIs and outcomes stay untouched.
  await page.addInitScript(({emulate})=>{
   if(location.pathname==='/world/future-machine.html'){
    const url=new URL(location.href);url.searchParams.set('renderer','canvas2d');history.replaceState(null,'',url);
    if(emulate){
     const calls=[];
     for(const name of ['replaceState','pushState']){
      const original=history[name].bind(history);
      history[name]=(...args)=>{const now=performance.now();while(calls.length&&now-calls[0]>=30000)calls.shift();if(calls.length>=100)throw new DOMException('History write limit','SecurityError');calls.push(now);return original(...args);};
     }
    }
   }
  },{emulate:browserName==='chromium'});
  await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
  await expect(page).toHaveURL(/\/world\/future-machine\.html\?/);
  await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
  await page.getByRole('button',{name:'Pause demo',exact:true}).click();
  expect(await page.evaluate(()=>Number(new URL(location.href).searchParams.get('month'))===window.futureMachine.state.month)).toBe(true);
  await seek(page,0);const initial=await snapshot(page,info,`${viewport.width}-matched-0`,errors);
  expect(initial.seed).toBe(42);expect(initial.firstDivergence.month).toBe(16);expect(initial.baselineBuildings).toEqual(initial.planBuildings);expect(initial.metrics.housingUnits.delta).toBe(0);
  const slider=page.getByTestId('future-machine-timeline');await reachable(slider);await page.keyboard.press('ArrowRight');
  await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(1);
  await seek(page,16);
  await reachable(page.getByRole('button',{name:'Difference-only',exact:true}));await page.keyboard.press('Enter');
  await reachable(page.getByRole('button',{name:'Side by side',exact:true}));await page.keyboard.press('Enter');
  const metrics=page.getByTestId('future-machine-metrics');await metrics.scrollIntoViewIfNeeded();await expect(metrics).toContainText('24 homes');
  await expect(metrics).toContainText(/1,000,000/);
  const why=page.getByRole('button',{name:'WHY · Homes',exact:true});await reachable(why);await page.keyboard.press('Enter');
  const story=page.getByRole('region',{name:'Recorded change story'});await story.scrollIntoViewIfNeeded();await expect(story).toContainText('PROJECT_COMPLETE');await expect(story).toContainText(initial.runId);await expect(story).toContainText(initial.modelVersion);
  const changed=await snapshot(page,info,`${viewport.width}-month-16-why`,errors);expect(changed.metrics.housingUnits.delta).toBe(24);expect(changed.evidence.some(e=>e.eventType==='PROJECT_COMPLETE')).toBe(true);
  expect(changed.planBuildings.some(row=>row.id===initial.firstDivergence.id)).toBe(true);
  await seek(page,0);const reversed=await snapshot(page,info,`${viewport.width}-reverse-0`,errors);
  expect(reversed.metrics.housingUnits.delta).toBe(0);expect(reversed.baselineBuildings).toEqual(reversed.planBuildings);expect(reversed.planBuildings.some(row=>row.id===initial.firstDivergence.id)).toBe(false);
  const futureInventory=page.getByRole('button').filter({hasText:initial.firstDivergence.id});await expect(futureInventory).toHaveCount(0);
  expect(reversed.scene.objects).toBe(initial.scene.objects);expect(errors).toEqual({page:[],console:[]});
 });
}
