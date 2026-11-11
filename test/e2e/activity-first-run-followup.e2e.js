import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {EXPERIENCES} from '../../world/universe/registry.js';

const dashboard=page=>page.getByRole('dialog',{name:'Activity history dashboard'});
async function openControls(page){const top=page.locator('#top');if(!await top.evaluate(n=>n.open))await top.locator(':scope > summary').click();}
async function openActivity(page){await page.getByRole('button',{name:'Activity dashboard',exact:true}).click();await expect(dashboard(page)).toBeVisible();await expect(dashboard(page).getByRole('status')).toHaveAttribute('data-state',/ready|empty/);}
async function exportJSON(page){const pending=page.waitForEvent('download');await dashboard(page).getByRole('button',{name:'Export JSON',exact:true}).click();const download=await pending;return JSON.parse(await readFile(await download.path(),'utf8'));}
async function reachable(locator){await locator.scrollIntoViewIfNeeded();return locator.evaluate(node=>{const a=node.getBoundingClientRect(),nav=document.querySelector('nav[aria-label="Connected universe"]'),b=nav?.getBoundingClientRect();const hit=document.elementFromPoint(a.x+a.width/2,a.y+a.height/2);return {x:a.x,y:a.y,width:a.width,height:a.height,visible:a.y>=0&&a.bottom<=innerHeight,hit:node===hit||node.contains(hit),navOverlap:!!b&&b.width>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};});}

test('Canvas legacy Activity retains real person filtering, history authority, seed and exports across mobile layouts',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/?demo=1&synthetic=1&people=30&renderer=canvas2d&seed=42');
 await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready),{timeout:60000}).toBe(true);
 await expect(page.locator('#view canvas')).toHaveAttribute('data-renderer','canvas2d');
 await openControls(page);await page.getByRole('button',{name:'Pause',exact:true}).click();
 const source=await page.evaluate(()=>window.hblWorldActivity.getSnapshot());
 expect(source.mode).toBe('legacy');expect(source.peopleCount).toBe(30);expect(source.modelVersion).toBe('neighborhood-activity.v2');
 const personId=String(source.people[0].id);expect(personId).toBeTruthy();
 await openActivity(page);await dashboard(page).getByLabel('Person ID',{exact:true}).fill(personId);
 await dashboard(page).getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(dashboard(page).getByRole('status')).toHaveAttribute('data-state',/ready|empty/);
 await dashboard(page).getByRole('button',{name:'Close',exact:true}).click();await expect(dashboard(page)).toBeHidden();
 await openControls(page);await page.locator('#speeds [data-s="60"]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblWorldActivity.getSnapshot().minute),{timeout:30000}).toBeGreaterThan(source.minute+10);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const held=await page.evaluate(()=>window.hblWorldActivity.getSnapshot());
 await openActivity(page);await expect(dashboard(page).getByLabel('Person ID',{exact:true})).toHaveValue(personId);
 await expect(dashboard(page).getByRole('status')).toHaveAttribute('data-state','ready');
 const actual=await page.evaluate(id=>window.hblWorldActivity.getHistory({filters:{personId:id},groupBy:'hour',actorId:id}),personId);
 const exported=await exportJSON(page);
 expect(exported.schemaVersion).toBe('activity-dashboard-export.v1');
 expect(exported.context).toMatchObject({mode:'legacy',runId:held.runId,modelVersion:held.modelVersion,populationRaw:30,query:{filters:{personId},actorId:personId}});
 expect(exported.context.minute).toBe(actual.coverage.toMinute);expect(exported.history).toEqual(actual);
 expect(exported.history.totals).toBeNull();expect(exported.analysis.scope).toBe('retained-person-routine');expect(exported.analysis.totalMinutes).toBeGreaterThan(0);
 expect(exported.history.actorTimeline.intervals.length).toBeGreaterThan(0);
 expect(exported.analysis.routine.every(row=>row.endMinute>row.startMinute)).toBe(true);
 await info.attach('actual-filtered-export',{body:JSON.stringify(exported,null,2),contentType:'application/json'});
 await dashboard(page).evaluate(n=>n.scrollTop=0);await page.screenshot({path:info.outputPath('activity-390-filtered.png')});
 await page.keyboard.press('Escape');await expect(dashboard(page)).toBeHidden();
 const layouts=[];
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await openControls(page);
  const pause=page.getByRole('button',{name:'Pause',exact:true}),bounds=await reachable(pause);
  expect(bounds.visible).toBe(true);expect(bounds.hit).toBe(true);expect(bounds.navOverlap).toBe(false);expect(bounds.height).toBeGreaterThanOrEqual(44);
  await pause.click();layouts.push({viewport,pause:bounds});
  await page.screenshot({path:info.outputPath(`controls-${viewport.width}x${viewport.height}.png`)});
 }
 const after=await page.evaluate(()=>window.hblWorldActivity.getSnapshot());expect(after.runId).toBe(source.runId);expect(after.minute).toBe(held.minute);
 await openActivity(page);await expect(dashboard(page)).toBeVisible();await page.keyboard.press('Escape');await expect(dashboard(page)).toBeHidden();
 expect(errors).toEqual([]);
 const visibleSeed=(await page.locator('#world-playback-facts').textContent()).split(' · Seed: ')[1];
 const evidence={source:held.runId,model:held.modelVersion,personId,minute:held.minute,retainedMinutes:exported.analysis.totalMinutes,visibleSeed,exportSeed:exported.context.seed??null,layouts,errors};
 await info.attach('activity-runtime-measurements',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
 console.log('ACTIVITY_FOLLOWUP',JSON.stringify(evidence));
 // Reproduction requires the authority seed as well as the current run identity.
 expect(exported.context.seed,'Activity export must retain the displayed authority seed').toBe(visibleSeed);
});

test('homepage gallery and directory navigation derive from the authoritative catalog',async({page},info)=>{
 await page.goto('/');await expect(page.locator('#experience-count')).toHaveText(`${EXPERIENCES.length} Interactive Worlds & Experiments`);
 await expect(page.locator('.gallery-card')).toHaveCount(EXPERIENCES.length);
 await expect(page.locator('.universe-kicker')).toContainText(`${EXPERIENCES.length} connected experiences`);
 expect(new Set(EXPERIENCES.map(row=>row.id)).size).toBe(EXPERIENCES.length);
 expect(new Set(EXPERIENCES.map(row=>row.route)).size).toBe(EXPERIENCES.length);
 const base=new URL(page.url()).origin;
 const links=await page.locator('.gallery-card header a').evaluateAll(nodes=>nodes.map(a=>({href:a.href,target:a.target,rel:a.rel})));
 expect(links).toHaveLength(EXPERIENCES.length);
 for(let i=0;i<links.length;i++){
  const actual=new URL(links[i].href),expected=new URL(EXPERIENCES[i].route,base);
  expect(actual.origin).toBe(base);expect(actual.pathname).toBe(expected.pathname);expect(actual.hash).toBe(expected.hash);
  for(const [key,value]of expected.searchParams)expect(actual.searchParams.get(key)).toBe(value);
  expect(links[i].target).toBe('_blank');expect(links[i].rel.split(' ')).toContain('noopener');
 }
 for(const row of EXPERIENCES){const enter=page.locator(`.universe-card a[data-app="${row.id}"]`);await expect(enter).toHaveCount(1);const href=new URL(await enter.getAttribute('href'),base);expect(href.origin).toBe(base);expect(href.searchParams.get('app')).toBe(row.id);}
 const worldline=page.locator('nav[aria-label="Universe navigation"] [data-app="worldline"]');
 await worldline.click();await expect(page.locator('#universe-stage iframe')).toHaveCount(1);
 const src=new URL(await page.locator('#universe-stage iframe').getAttribute('src'),base);
 expect(src.pathname).toBe(new URL(EXPERIENCES.find(row=>row.id==='worldline').route,base).pathname);
 expect(src.searchParams.get('worldId')).toBe('world:hbl:main');
 const response=await page.request.get(src.href);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('text/html');
 await page.screenshot({path:info.outputPath('catalog-worldline-navigation.png'),fullPage:true});
 console.log('CATALOG_FOLLOWUP',JSON.stringify({count:EXPERIENCES.length,uniqueIds:new Set(EXPERIENCES.map(row=>row.id)).size,selected:src.pathname}));
});
