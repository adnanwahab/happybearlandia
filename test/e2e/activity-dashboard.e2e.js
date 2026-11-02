import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const ORIGIN={lat:29.7286,lng:-95.4746};
// Controlled map geometry only. The real town/model/runtime/worker/dashboard
// execute unchanged; demographic and behavioral outputs are not stubbed.
async function setupWorld(page){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/api/area?*',route=>{
  const query=new URL(route.request().url()).searchParams,lat=Number(query.get('lat')||ORIGIN.lat),lng=Number(query.get('lng')||ORIGIN.lng),key=`${lat}:${lng}`;
  const buildings=Array.from({length:24},(_,i)=>{const a=lat-.0008+(i%6)*.0003,b=lng-.0005+Math.floor(i/6)*.0003;return{id:`${key}:building-${i}`,kind:i%6===0?'work':'home',levels:2,pts:[[a,b],[a+.00015,b],[a+.00015,b+.00015],[a,b+.00015],[a,b]]};});
  return route.fulfill({json:{source:'osm',attribution:'Controlled QA geometry; not observed population',origin:{lat,lng},radiusM:250,areaKey:key,buildings,roads:[{kind:'residential',pts:[[lat-.001,lng-.001],[lat-.001,lng+.0015]]},{kind:'residential',pts:[[lat+.001,lng-.001],[lat+.001,lng+.0015]]}],pois:[],floodZones:[],floodZonesSource:'unavailable'}});
 });
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__activityQa={stepLegacy(minutes){world.step(minutes);if(selected)renderInspector();return world.getActivitySnapshot();},legacy(){return world.getActivitySnapshot();},getSelected(){return selected?structuredClone(selected):null;},state(){const s=livingWorld?.active?livingWorld.getRuntime()?.getSnapshot():null;return{mode:s?'living':'legacy',minute:s?.minute??world.t,positions:s?s.visibleAgents.map(p=>[p.id,p.x,p.z]):world.people.map(p=>[p.id,p.x,p.z]),needs:s?s.visibleAgents.map(p=>[p.id,p.needs]):world.people.map(p=>[p.id,p.needs]),camera:controls.target.toArray(),paused:playback.getState().paused};}};`});});
 return errors;
}
const dialog=page=>page.getByRole('dialog',{name:'Activity history dashboard'});
async function openDashboard(page){await page.locator('#activity-dashboard-button').click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole('status')).toHaveAttribute('data-state',/ready|empty/,{timeout:60000});}
async function downloadHistory(page){const promise=page.waitForEvent('download');await dialog(page).getByRole('button',{name:'Export JSON',exact:true}).click();const download=await promise;return JSON.parse(await readFile(await download.path(),'utf8'));}
async function closeDashboard(page){await dialog(page).getByRole('button',{name:'Close',exact:true}).click();await expect(dialog(page)).toBeHidden();}
async function pausedCameraCheck(page){const before=await page.evaluate(()=>window.__activityQa.state());await page.waitForTimeout(400);const held=await page.evaluate(()=>window.__activityQa.state());expect(held.minute).toBe(before.minute);expect(held.positions).toEqual(before.positions);expect(held.needs).toEqual(before.needs);await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');const moved=await page.evaluate(()=>window.__activityQa.state());expect(moved.camera).not.toEqual(before.camera);expect(moved.minute).toBe(before.minute);return before;}

test('legacy business-mode dashboard accounts actual time, filters and person selection without changing paused state',async({page})=>{
 test.setTimeout(120000);const errors=await setupWorld(page);
 await page.goto('/world?business_mode=true&people=30&renderer=webgl&quality=LOW');await page.waitForFunction(()=>Boolean(window.__activityQa&&window.hblWorldActivity),null,{timeout:60000});await page.locator('#speeds [data-s="0"]').click();
 const before=await page.evaluate(()=>window.hblWorldActivity.getHistory());const population=await page.evaluate(()=>window.__activityQa.legacy().peopleCount);
 await page.evaluate(()=>window.__activityQa.stepLegacy(180));
 const history=await page.evaluate(()=>window.hblWorldActivity.getHistory());expect(history.totals.agentMinutes-before.totals.agentMinutes).toBe(population*180);expect(history.buckets.length).toBeGreaterThan(1);
 await openDashboard(page);const dashboard=dialog(page);await expect(dashboard.getByRole('status')).toContainText(/legacy/i);await expect(dashboard.getByRole('img',{name:/Activity time budget/})).toBeVisible();
 const chart=dashboard.getByRole('img',{name:/Activity time budget/});expect(await chart.locator('rect').count()).toBeGreaterThan(0);
 const exported=await downloadHistory(page);expect(exported.history.totals.agentMinutes).toBe(history.totals.agentMinutes);expect(exported.analysis.totalMinutes).toBe(history.totals.agentMinutes);expect(exported.context.mode).toBe('legacy');expect(exported.context.populationRaw).toBe(population);expect(exported.context.runId).toBeTruthy();
 const all=Object.entries(history.totals.activityMinutes).find(([,value])=>value>0);await dashboard.getByLabel('Activity',{exact:true}).fill(all[0]);await dashboard.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(dashboard.getByRole('status')).toHaveAttribute('data-state','ready');
 const filtered=await downloadHistory(page);expect(filtered.analysis.topActivities.every(row=>row.name===all[0])).toBe(true);expect(filtered.coverage.totalsScope).toContain('retained');
 await dashboard.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(dashboard.getByRole('status')).toHaveAttribute('data-state','ready');
 const personButton=dashboard.locator('table button').first();await expect(personButton).toBeVisible();const personId=await personButton.textContent();await personButton.click();expect(await page.evaluate(()=>window.__activityQa.getSelected()?.type)).toBe('person');await expect(dashboard.getByLabel('Person ID',{exact:true})).toHaveValue(personId);await expect(dashboard.getByRole('status')).toHaveAttribute('data-state','ready');const personal=await downloadHistory(page);expect(personal.context.query.filters.personId).toBe(personId);expect(personal.history.totals).toBeNull();expect(personal.analysis.totalMinutes).toBeGreaterThanOrEqual(180);
 await dashboard.evaluate(node=>node.scrollTop=0);await page.screenshot({path:'/private/tmp/hbl-legacy-activity-dashboard.png'});
 await closeDashboard(page);await pausedCameraCheck(page);await page.evaluate(()=>window.__activityQa.stepLegacy(1));expect((await page.evaluate(()=>window.hblWorldActivity.getHistory())).totals.agentMinutes).toBe(history.totals.agentMinutes+population);
 expect(errors).toEqual([]);console.log('LEGACY_DASHBOARD_ACTUAL',JSON.stringify({population,deltaAgentMinutes:population*180,buckets:history.buckets.length,retention:history.retention}));
});

test('Living10k dashboard preserves exact aggregates, discloses truncated detail and clears histories on population reset',async({page})=>{
 test.setTimeout(180000);const errors=await setupWorld(page);
 await page.goto('/world?business_mode=true&people=20&seed=42&renderer=webgl&quality=LOW');await page.waitForFunction(()=>Boolean(window.__activityQa&&window.hblWorldActivity),null,{timeout:60000});await page.locator('#speeds [data-s="0"]').click();await page.getByTestId('add-population').click();
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime()?.getSnapshot()?.config.population),{timeout:60000}).toBe(10000);
 await page.evaluate(async()=>{const runtime=window.hblLivingWorld.getRuntime();runtime.pause();await runtime.stepToTime(600);});
 const history=await page.evaluate(()=>window.hblWorldActivity.getHistory());expect(history.totals.agentMinutes).toBeCloseTo(10000*600,6);expect(history.retention.droppedEvents).toBeGreaterThan(0);expect(history.recentEvents.length).toBeLessThanOrEqual(history.retention.maxEvents);
 await openDashboard(page);const dashboard=dialog(page);await expect(dashboard.getByRole('status')).toContainText(/living/i);await expect(dashboard.locator('.activity-coverage')).toContainText(`dropped detail ${history.retention.droppedEvents}`);
 const exported=await downloadHistory(page);expect(exported.history.totals.agentMinutes).toBeCloseTo(6000000,6);expect(exported.retention.droppedEvents).toBe(history.retention.droppedEvents);expect(exported.analysis.series.length).toBeGreaterThan(1);expect(exported.context.mode).toBe('living');expect(exported.context.populationRaw).toBe(10000);expect(exported.context.runId).toBeTruthy();
 await dashboard.evaluate(node=>node.scrollTop=0);await page.screenshot({path:'/private/tmp/hbl-living10k-activity-dashboard.png'});
 await closeDashboard(page);await pausedCameraCheck(page);
 const beforeReset=await page.evaluate(()=>window.hblWorldActivity.getSnapshot().runId);await page.getByTestId('add-population').click();await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot()?.config.population),{timeout:30000}).toBe(20000);
 expect(await page.evaluate(()=>window.hblWorldActivity.getSnapshot().runId)).not.toBe(beforeReset);const reset=await page.evaluate(()=>window.hblWorldActivity.getHistory());expect(reset.totals.agentMinutes).toBe(0);
 await openDashboard(page);await expect(dashboard.getByRole('status')).toHaveAttribute('data-state','empty');const empty=await downloadHistory(page);expect(empty.history.totals.agentMinutes).toBe(0);expect(empty.analysis.series).toHaveLength(0);expect(empty.context.populationRaw).toBe(20000);expect(empty.context.runId).not.toBe(exported.context.runId);
 await closeDashboard(page);await page.evaluate(()=>window.hblLivingWorld.getRuntime().step());const stepped=await page.evaluate(()=>window.hblWorldActivity.getHistory());expect(stepped.totals.agentMinutes).toBe(20000);
 expect(errors).toEqual([]);console.log('LIVING_DASHBOARD_ACTUAL',JSON.stringify({population:10000,agentMinutes:history.totals.agentMinutes,buckets:history.buckets.length,retention:history.retention,resetPopulation:20000,afterStep:stepped.totals.agentMinutes}));
});
