import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';

test('world population, worker inspector and actual parameter reset preserve stable synthetic identities',async({page})=>{
 test.setTimeout(150000);
 const errors=[],aiCalls=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',request=>{const url=new URL(request.url());if(/api\.(openai|anthropic)\.com|generativelanguage\.googleapis\.com/.test(url.hostname)||url.pathname==='/api/world-edits/propose')aiCalls.push(url.href);});
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));
 await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.goto('/world?demo=1&living=1&people=20&seed=42&renderer=webgl&quality=LOW&business_mode=true');
 await page.waitForFunction(()=>window.hblLivingWorld?.getRuntime()?.getSnapshot()&&document.querySelector('[data-testid="population-studio"]'),null,{timeout:90000});
 const studio=page.getByTestId('population-studio');
 await studio.locator('[data-ps-pause]').click();
 const population=studio.locator('[data-population-parameter="population"]');
 await population.fill('240');
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot()?.config.population),{timeout:30000}).toBe(240);
 const before=await page.evaluate(async()=>{const runtime=window.hblLivingWorld.getRuntime(),snapshot=runtime.getSnapshot(),person=await runtime.inspectPerson(snapshot.visibleAgents[0].id);window.__pairedPersonId=snapshot.visibleAgents[0].id;return{config:snapshot.config,person,household:await runtime.inspectHousehold(person.householdId),metrics:snapshot.metrics,revision:snapshot.runtime.revision};});
 const rent=studio.locator('[data-population-parameter="rentMultiplier"]');
 await rent.evaluate(node=>{for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});
 await rent.fill('1.5');
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot()?.config.rentMultiplier),{timeout:30000}).toBe(1.5);
 const after=await page.evaluate(async()=>{const runtime=window.hblLivingWorld.getRuntime(),snapshot=runtime.getSnapshot();const person=await runtime.inspectPerson(window.__pairedPersonId);return{person,household:await runtime.inspectHousehold(person.householdId),snapshot};});
 expect(after.person.id??after.person.personId).toBe(before.person.id??before.person.personId);
 expect(after.person.householdId).toBe(before.person.householdId);
 expect(after.snapshot.runtime.revision).toBeGreaterThan(before.revision);
 expect(after.snapshot.previousRun).toBeTruthy();
 expect(after.snapshot.metrics.meanHousingBurden).toBeGreaterThan(before.metrics.meanHousingBurden*1.4);
 expect(after.household.id).toBe(before.household.id);expect(after.household.rent).toBeGreaterThan(before.household.rent*1.4);
 await expect(studio.locator('[data-ps-comparison-note]')).toContainText('Actual paired behavior preview',{timeout:45000});
 const exportButton=studio.locator('[data-ps-export]');await exportButton.evaluate(node=>{for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});
 const downloadPromise=page.waitForEvent('download');await exportButton.click();const download=await downloadPromise;await download.saveAs('/private/tmp/hbl-living-city-rent-comparison.json');
 const paired=JSON.parse(await readFile('/private/tmp/hbl-living-city-rent-comparison.json','utf8'));
 expect(paired.rows).toHaveLength(2);expect(paired.rows.every(r=>r.status==='completed')).toBe(true);
 const baselineSeries=paired.rows.find(r=>r.manifest.configIndex===0).summary.timeSeries,treatmentSeries=paired.rows.find(r=>r.manifest.configIndex===1).summary.timeSeries;
 expect(baselineSeries.length).toBeGreaterThan(1);expect(treatmentSeries.length).toBeGreaterThan(1);
 expect(treatmentSeries.some(row=>{const baseline=baselineSeries.find(b=>b.minute===row.minute);return baseline&&(row.metrics||row).meanHousingBurden>(baseline.metrics||baseline).meanHousingBurden*1.1;})).toBe(true);
 await page.evaluate(async()=>{await window.hblLivingWorld.getRuntime().stepToTime(720);});
 await studio.locator('[data-ps-metric]').selectOption('meanHousingBurden');
 await studio.locator('[data-ps-chart]').scrollIntoViewIfNeeded();
 await expect(studio.locator('[data-ps-chart] polyline')).toHaveCount(2);
 const linePoints=await studio.locator('[data-ps-chart] polyline').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('points')));expect(linePoints[0]).not.toBe(linePoints[1]);
 await page.screenshot({path:'/private/tmp/hbl-living-city-paired-trajectories.png'});
 const transit=studio.locator('[data-population-parameter="transitService"]');
 await transit.evaluate(node=>{for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});
 await transit.fill('2');
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot()?.config.transitService),{timeout:30000}).toBe(2);
 await expect(studio.locator('[data-ps-comparison-note]')).toContainText('Actual paired behavior preview',{timeout:45000});
 const tick=await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().runtime.tick);
 await studio.locator('[data-ps-step]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().runtime.tick),{timeout:30000}).toBeGreaterThan(tick);
 await page.evaluate(async()=>{await window.hblLivingWorld.getRuntime().stepToTime(720);const sample=window.hblLivingWorld.getRuntime().getSnapshot().visibleAgents.find(p=>p.currentActivity==='HOME');await window.hblLivingWorld.selectPerson(sample?.id||window.__pairedPersonId);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 await page.locator('[data-lc-person]').scrollIntoViewIfNeeded();
 const actualNeeds=await page.evaluate(()=>window.hblLivingWorld.getSelection().needs);
 const needMeters=page.locator('[data-lc-needs] [data-person-needs]');await expect(needMeters.getByRole('meter')).toHaveCount(4);
 for(const [key,value]of Object.entries(actualNeeds))await expect(needMeters.locator(`[data-need-value="${key}"]`)).toHaveText(String(Math.round(value)));
 await needMeters.scrollIntoViewIfNeeded();
 await page.screenshot({path:'/private/tmp/hbl-living-city-daytime-person.png'});
 await page.getByTestId('workers-button').click();
 const inspector=page.getByTestId('worker-inspector');await expect(inspector).toContainText('Population');
 await expect(inspector).toContainText('Per-worker memory: unavailable');
 await expect(inspector.getByRole('button',{name:'Terminate worker',exact:true})).toHaveCount(0);
 await page.screenshot({path:'/private/tmp/hbl-living-city-integrated.png'});
 expect(new URL(page.url()).searchParams.get('business_mode')).toBe('true');
 await expect(page.locator('[data-lc-error]')).toHaveText('');
 expect(aiCalls).toEqual([]);expect(errors).toEqual([]);
 console.log('LIVING_CITY_ACTUAL_EDIT_REPORT',JSON.stringify({beforeBurden:before.metrics.meanHousingBurden,afterBurden:after.snapshot.metrics.meanHousingBurden,beforeRent:before.household.rent,afterRent:after.household.rent,pairedResultRows:paired.rows.length,baselineSamples:baselineSeries.length,treatmentSamples:treatmentSeries.length,personId:after.person.id??after.person.personId,householdId:after.person.householdId}));
});

test('people benchmark repaints during actual asynchronous behavior with no AI calls',async({page},testInfo)=>{
 test.setTimeout(150000);const aiCalls=[];
 page.on('request',r=>{const url=new URL(r.url());if(/api\.(openai|anthropic)\.com|generativelanguage\.googleapis\.com/.test(url.hostname)||url.pathname==='/api/world-edits/propose')aiCalls.push(url.href);});
 await page.goto('/world/bench/people');await page.waitForFunction(()=>Boolean(window.hblPeopleBenchmark));
 expect(await page.evaluate(()=>window.hblPeopleBenchmark.getReport())).toBeNull();
 const counts=(process.env.HBL_BENCH_POPULATIONS||'10000').split(',').map(Number);
 expect(counts.length).toBeLessThanOrEqual(3);expect(counts.every(n=>[10000,50000,100000].includes(n))).toBe(true);
 for(const population of counts){
  const report=await page.evaluate(population=>window.hblPeopleBenchmark.run({population,days:1,seed:42}),population);
  expect(report.population).toBe(population);expect(report.steps).toBe(24);expect(report.authoritativeWorkers).toBe(1);
  expect(report.generationMs).toBeGreaterThan(0);expect(report.simulationMs).toBeGreaterThan(0);expect(report.typedStateBytes).toBeGreaterThan(0);
  expect(report.frameProbe.callbacks).toBeGreaterThan(1);expect(report.simulatedDaysPerSecond).toBeGreaterThan(0);
  expect(report.actualSimulatedMinutes).toBe(1440);expect(report.tripsPerSecond.value).toBeGreaterThan(0);
  const body=JSON.stringify(report,null,2);await writeFile(`/private/tmp/hbl-people-benchmark-${population}.json`,body);await testInfo.attach(`actual-${population}-people`,{body,contentType:'application/json'});
  console.log('PEOPLE_BENCHMARK_ACTUAL',JSON.stringify({population,generationMs:report.generationMs,simulationMs:report.simulationMs,snapshotMs:report.snapshotMs,daysPerSecond:report.simulatedDaysPerSecond,tripsPerSecond:report.tripsPerSecond,decisionsPerSecond:report.decisionsPerSecond,typedStateBytes:report.typedStateBytes,frameProbe:report.frameProbe}));
 }
 expect(aiCalls).toEqual([]);
});

test('controlled long-distance transit policy changes real trip choices and independent futures are worker-count invariant',async({page})=>{
 test.setTimeout(150000);
 await page.route('**/__living-policy-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled actual population policy fixture</title>'}));
 await page.goto('/__living-policy-test');
 const result=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');
  const {defaultPopulationConfig}=await import('/world/population/contracts.js');
  const baseline={...defaultPopulationConfig,population:600,seed:42,transitService:0,transitCapacity:100000,transitFare:0,carCostPerKm:1,moveThreshold:2,layoffRate:0,hiringRate:0};
  const configs=[baseline,{...baseline,transitService:4}];
  const worldContext={id:'explicit-long-distance-policy-fixture',districts:Array.from({length:4},(_,i)=>({id:`long-${i}`,label:`Synthetic fixture ${i}`,x:i*8000,z:i%2*2000,transit:1,services:.7,environment:.7,housingUnits:200,jobs:200}))};
  const runtime=createPopulationRuntime({config:baseline,worldContext,workerCount:1});
  try{
   await runtime.ready;runtime.pause();
   const request={configs,runs:4,seeds:[42,43,44,45],horizonDays:2};
   const one=await runtime.runExperiments(request).ready;
   runtime.resizeWorkers(8);const eight=await runtime.runExperiments(request).ready;
   return{one,eight};
  }finally{runtime.destroy();}
 });
 expect(result.one.rows.every(r=>r.status==='completed')).toBe(true);expect(result.eight.rows.every(r=>r.status==='completed')).toBe(true);
 const comparable=run=>({seed:run.manifest.seed,configIndex:run.manifest.configIndex,metrics:run.summary.metrics,tripCounts:run.summary.tripCountsByMode});
 expect(result.eight.rows.map(comparable)).toEqual(result.one.rows.map(comparable));
 const base=result.one.rows.filter(r=>r.manifest.configIndex===0),treatment=result.one.rows.filter(r=>r.manifest.configIndex===1);
 const totals=rows=>rows.reduce((a,r)=>{for(const [k,v]of Object.entries(r.summary.tripCountsByMode))a[k]=(a[k]||0)+v;return a;},{});
 const before=totals(base),after=totals(treatment),sum=values=>Object.values(values).reduce((a,b)=>a+b,0);
 expect((before.bus||0)+(before.rail||0)).toBe(0);
 expect((after.bus||0)+(after.rail||0)).toBeGreaterThan(0);
 expect((after.car||0)/sum(after)).toBeLessThan((before.car||0)/sum(before));
 for(const row of result.one.rows)expect(Object.values(row.summary.metrics).every(Number.isFinite)).toBe(true);
 console.log('ACTUAL_PAIRED_TRANSIT_POLICY',JSON.stringify({before,after,beforeCarShare:(before.car||0)/sum(before),afterCarShare:(after.car||0)/sum(after),invariance:'same independent seeded futures with requested pool counts 1 and 8; shared live state remains single authoritative worker'}));
});

test('people benchmark cancellation terminates actual work and permits a fresh measured run',async({page})=>{
 await page.goto('/world/bench/people');await page.waitForFunction(()=>Boolean(window.hblPeopleBenchmark));
 await page.evaluate(()=>{window.pendingReport=window.hblPeopleBenchmark.run({population:100000,days:31,seed:42}).catch(error=>({error:error.message}));});
 await page.waitForFunction(async()=>{const {getWorkerRegistry}=await import('/world/workers/worker-registry.js');return getWorkerRegistry().getSnapshot().workers.some(w=>w.status==='busy');});
 await page.locator('[data-cancel]').click();
 expect(await page.evaluate(()=>window.pendingReport)).toEqual({error:'Cancelled by user; no result substituted.'});
 expect(await page.evaluate(()=>window.hblPeopleBenchmark.getReport())).toBeNull();
 expect(await page.evaluate(async()=>{const {getWorkerRegistry}=await import('/world/workers/worker-registry.js');return getWorkerRegistry().getSnapshot().workers.length;})).toBe(0);
 const report=await page.evaluate(()=>window.hblPeopleBenchmark.run({population:10000,days:1,seed:42}));expect(report.population).toBe(10000);expect(report.actualSimulatedMinutes).toBe(1440);
});
