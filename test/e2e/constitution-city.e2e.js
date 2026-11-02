import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('public clauses drive actual paired workers, exact city replay and bounded time-machine controls',async({page})=>{
 test.setTimeout(150000);const errors=[],paid=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/api\.(openai|anthropic)\.com|generativelanguage\.googleapis\.com/.test(new URL(r.url()).hostname))paid.push(r.url());});
 await page.addInitScript(()=>{window.__constitutionWorkers=[];const Original=Worker;window.Worker=class extends Original{constructor(url,options){super(url,options);if(String(url).includes('constitution-city/runtime.worker'))window.__constitutionWorkers.push(String(url));}};});
 await page.goto('/world/constitution-city.html?package=A&renderer=webgl');
 await page.waitForFunction(()=>Boolean(window.hblConstitutionCity?.studio),null,{timeout:60000});
 const ui=page.getByTestId('constitution-studio');await expect(ui.locator('[data-cc-clause] option')).toHaveCount(10);await expect(ui).toContainText('not enacted constitutional text');
 const source=await page.evaluate(()=>({ids:window.hblConstitutionCity.plan.clauses.map(c=>c.id),supported:window.hblConstitutionCity.plan.clauses.filter(c=>c.supported).map(c=>c.id)}));
 expect(source.ids).toEqual(expect.arrayContaining(['s_311','h_lots','cc_licensing','sb_filing','fx_review','h_vouchers','cc_subsidy','f_drainage','t_brt','mh_988']));expect(source.supported.sort()).toEqual(['f_drainage','h_lots','t_brt']);
 expect(await page.evaluate(()=>window.hblConstitutionCity.studio.getState().result)).toBeNull();
 await ui.locator('[data-cc-clause]').selectOption('cc_licensing');await expect(ui.locator('[data-cc-clause-detail]')).toContainText('Unsupported');
 await ui.locator('[data-cc-clause]').selectOption('h_lots');await ui.locator('[data-cc-years]').fill('1');await ui.locator('[data-cc-run]').click();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblConstitutionCity.studio.getState().selected)),{timeout:90000}).toBe(true);
 const result=await page.evaluate(()=>window.hblConstitutionCity.studio.getState().result);
 expect(result.manifest.runs).toBe(2);expect(result.manifest.months).toBe(12);expect(result.runs).toHaveLength(6);expect(result.runs.every(r=>r.status==='completed')).toBe(true);
 expect(await page.evaluate(()=>window.__constitutionWorkers.length)).toBeGreaterThan(0);
 const replay=await page.evaluate(async()=>{const host=window.hblConstitutionCity,state=host.studio.getState(),row=state.result.runs.find(r=>r.scenarioId==='proposal-a'&&r.runIndex===0);await host.studio.selectFuture(row.id,12);const selected=host.studio.getState().selected,{cityMetrics}=await import('/world/city/engine.js');return{recorded:row.metricsTimeline.find(p=>p.month===12).metrics,actual:cityMetrics(selected.state),baseline:cityMetrics(selected.baselineState),baselineRecorded:state.result.runs.find(r=>r.scenarioId==='current'&&r.seed===row.seed).metricsTimeline.find(p=>p.month===12).metrics,month:selected.month,seed:selected.seed,events:selected.events.length};});
 expect(replay.actual).toEqual(replay.recorded);expect(replay.baseline).toEqual(replay.baselineRecorded);expect(replay.month).toBe(12);
 await expect(ui.locator('[data-cc-before] canvas')).toBeVisible();await expect(ui.locator('[data-cc-after] canvas')).toBeVisible();await expect(ui.locator('[data-cc-status]')).toContainText('not the actual city');
 await page.waitForFunction(()=>window.hblConstitutionCity.views?.length===2&&window.hblConstitutionCity.views.every(view=>view.getStats().backend),null,{timeout:30000});
 const cameraBefore=await page.evaluate(()=>window.hblConstitutionCity.views[0].getCamera());await ui.locator('[data-cc-before] canvas').scrollIntoViewIfNeeded();const canvasBounds=await ui.locator('[data-cc-before] canvas').boundingBox();await page.mouse.move(canvasBounds.x+canvasBounds.width*.5,canvasBounds.y+canvasBounds.height*.5);await page.mouse.down();await page.mouse.move(canvasBounds.x+canvasBounds.width*.5+55,canvasBounds.y+canvasBounds.height*.5+15,{steps:5});await page.mouse.up();await page.waitForTimeout(250);const cameras=await page.evaluate(()=>window.hblConstitutionCity.views.map(view=>view.getCamera()));expect(cameras[0].position).not.toEqual(cameraBefore.position);for(const key of ['position','target'])for(let i=0;i<3;i++)expect(cameras[1][key][i]).toBeCloseTo(cameras[0][key][i],4);
 const futureButtons=ui.locator('[data-cc-futures] button');await expect(futureButtons).toHaveCount(2);await futureButtons.last().click();
 await expect.poll(()=>page.evaluate(()=>window.hblConstitutionCity.studio.getState().selected?.seed)).toBe(result.runs.find(r=>r.scenarioId==='proposal-a'&&r.runIndex===1).seed);
 await ui.scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/hbl-constitution-city.png',fullPage:true});
 const last=await page.evaluate(()=>window.hblConstitutionCity.studio.getState().runId);
 await ui.locator('[data-cc-month]').focus();await ui.locator('[data-cc-month]').press('End');await expect(ui.locator('[data-cc-status]')).toContainText('not evaluated');
 expect(await page.evaluate(()=>window.hblConstitutionCity.studio.getState().runId)).toBe(last);expect(await page.evaluate(()=>window.hblConstitutionCity.studio.getState().month)).toBe(12);
 await page.evaluate(()=>window.hblConstitutionCity.studio.selectFuture(window.hblConstitutionCity.studio.getState().runId,12));
 await ui.locator('[data-cc-question]').fill('Why did housing change?');await ui.locator('[data-cc-ask]').click();await expect(ui.locator('[data-cc-answer]')).not.toBeEmpty();
 const downloadPromise=page.waitForEvent('download');await ui.locator('[data-cc-export]').click();const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));expect(exported.result.manifest.seed).toBe(42);expect(exported.selection.month).toBe(12);
 expect(errors).toEqual([]);expect(paid).toEqual([]);console.log('ACTUAL_CONSTITUTION_REPLAY',JSON.stringify({runs:result.runs.length,month:replay.month,supported:source.supported,events:replay.events}));
});

test('explicit100/1000 futures use actual worker catalogs, reject unsafe workloads and cancel without fabricated rows',async({page})=>{
 test.setTimeout(150000);await page.route('**/__constitution-worker-qa',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Actual Constitution worker QA</title>'}));await page.goto('/__constitution-worker-qa');
 const reports=await page.evaluate(async()=>{const {createCity}=await import('/world/city/seed.js'),{normalizeDearCongressPlan}=await import('/world/constitution-city/plan.js'),{createConstitutionRuntime}=await import('/world/constitution-city/runtime.js'),{cityMetrics}=await import('/world/city/engine.js');const payload=await(await fetch('/world/constitution-city/dear-congress-plan.json')).json(),plan=normalizeDearCongressPlan(payload),initial=createCity({households:3}),runtime=createConstitutionRuntime({initial,plan}),reports=[];try{for(const runs of [100,1000]){const result=await runtime.run({scenarios:[{id:'current',label:'Current rules',clauseIds:[]}],runs,months:1,seed:42});const row=result.runs.at(-1),state=await runtime.enterFuture({runId:row.id,month:1});reports.push({requested:runs,actual:result.runs.length,completed:result.runs.filter(r=>r.status==='completed').length,status:result.status,months:result.manifest.months,households:result.manifest.initial.households.length,recorded:row.metricsTimeline[1].metrics,replayed:cityMetrics(state.state)});}const long=await runtime.run({scenarios:[{id:'current',label:'Current rules',clauseIds:[]},{id:'proposal',label:'Housing proposal',clauseIds:['h_lots']}],runs:1,months:360,seed:42});const finalRow=long.runs.find(row=>row.scenarioId==='proposal'),at30=await runtime.enterFuture({runId:finalRow.id,month:360});const thirtyYears={month:at30.state.month,actual:cityMetrics(at30.state),recorded:finalRow.metricsTimeline.find(point=>point.month===360).metrics};let rejected=null;try{await runtime.run({scenarios:[{id:'current',label:'Current rules',clauseIds:[]},{id:'proposal',label:'Housing proposal',clauseIds:['h_lots']}],runs:1000,months:360,seed:42});}catch(error){rejected=error.message;}const abort=new AbortController(),pending=runtime.run({scenarios:[{id:'current',label:'Current rules',clauseIds:[]}],runs:1000,months:12,seed:42,signal:abort.signal});abort.abort();let cancelled=false,cancelledRows=null;try{const partial=await pending;cancelled=partial.status==='cancelled';cancelledRows=partial.runs.length;if(partial.runs.some(row=>!['completed','failed'].includes(row.status)))throw new Error('Cancellation fabricated an unexecuted row');}catch(error){cancelled=error.name==='AbortError'||/cancel|abort/i.test(error.message);}return{reports,rejected,cancelled,cancelledRows,thirtyYears};}finally{runtime.destroy();}});
 for(const row of reports.reports){expect(row.actual).toBe(row.requested);expect(row.completed).toBe(row.requested);expect(row.months).toBe(1);expect(row.households).toBe(3);expect(row.status).toBe('completed');expect(row.replayed).toEqual(row.recorded);}
 expect(reports.thirtyYears.month).toBe(360);expect(reports.thirtyYears.actual).toEqual(reports.thirtyYears.recorded);
 expect(reports.rejected).toMatch(/budget|limit|work|exceed/i);expect(reports.cancelled).toBe(true);if(reports.cancelledRows!==null)expect(reports.cancelledRows).toBeLessThan(1000);
 console.log('ACTUAL_CONSTITUTION_CATALOG_COUNTS',JSON.stringify(reports.reports.map(({requested,actual,months,households})=>({requested,actual,months,households}))));
});

test('original business-mode world exposes public clause scope and carries exact location to the paired workspace',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.goto('/world?demo=1&people=20&renderer=webgl&quality=LOW&business_mode=true&lat=29.7286&lng=-95.4746');
 const host=page.getByTestId('constitution-world-diff');await expect(host).toBeVisible({timeout:60000});await host.locator('summary').click();
 await expect(host.locator('[data-cc-world-clause] option')).toHaveCount(10,{timeout:30000});
 await host.getByLabel('Plan clause',{exact:true}).selectOption('h_lots');await expect(host.locator('[data-cc-world-mapping]')).not.toBeEmpty();
 const link=host.locator('[data-cc-world-lab]'),url=new URL(await link.getAttribute('href'),page.url());expect(url.pathname).toBe('/world/constitution-city.html');expect(url.searchParams.get('lat')).toBe('29.7286');expect(url.searchParams.get('lng')).toBe('-95.4746');expect(url.searchParams.get('clause')).toBe('h_lots');expect(url.searchParams.get('planId')).toBeTruthy();expect(await page.evaluate(()=>window.hblConstitutionWorldHost.getStats().drawObjects)).toBeGreaterThan(0);
 await host.getByLabel('Plan clause',{exact:true}).selectOption('cc_licensing');await expect(host.locator('[data-cc-world-mapping]')).toContainText(/unavailable|unsupported/i);
 expect(new URL(page.url()).searchParams.get('business_mode')).toBe('true');expect(errors).toEqual([]);
 await page.screenshot({path:'/private/tmp/hbl-constitution-world-entry.png'});
});
