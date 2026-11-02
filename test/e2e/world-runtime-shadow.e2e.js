import {test,expect} from '@playwright/test';

async function observeWorld(page){
 const workers=[];page.on('worker',worker=>workers.push(worker.url()));
 await page.route('**/api/outcomes',route=>route.fulfill({json:{outcomes:[]}}));
 await page.route('**/api/overpass-health',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__runtimeContext=()=>livingWorld?.getContext?.();window.__runtimeCulture=()=>world.culture;window.__runtimeQA=()=>({minute:world.t,people:world.people.map(p=>({id:p.id,x:p.x,z:p.z,money:p.money,needs:{...p.needs}}))});`});});
 return workers;
}

test('legacy world does not create an optional canonical shadow by default and pause freezes visible residents',async({page})=>{
 test.setTimeout(120000);const workers=await observeWorld(page);
 await page.goto('/world?demo=1&people=30&seed=42&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>Boolean(window.__runtimeQA),null,{timeout:90000});
 await page.locator('#speeds [data-s="0"]').click();await page.waitForTimeout(250);
 const before=await page.evaluate(()=>window.__runtimeQA());await page.waitForTimeout(500);const after=await page.evaluate(()=>window.__runtimeQA());
 expect(after).toEqual(before);expect(before.people).toHaveLength(30);
 expect(workers.filter(url=>url.includes('/runtime/shadow.worker.js'))).toEqual([]);
 await expect(page.getByTestId('shadow-comparison')).toHaveCount(0);
});

test('canonical runtime observations are detached, seeded steps repeat and policies change inputs rather than reported outcomes',async({page})=>{
 await page.route('**/__runtime-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Actual WorldRuntime QA</title>'}));await page.goto('/__runtime-qa');
 const result=await page.evaluate(async()=>{
  const {createWorldRuntime}=await import('/world/runtime/world-runtime.js');
  const config={seed:42,population:{population:30},initialMinute:360,worldContext:{districts:[{id:'a',x:0,z:0,transit:.8,services:.8},{id:'b',x:1200,z:0,transit:.8,services:.8}]}};
  const first=createWorldRuntime(config),second=createWorldRuntime(config);
  try{
   const before=first.serialize();for(let i=0;i<3;i++){first.snapshot();first.observe();}const after=first.serialize();
   const snapshot=first.snapshot();try{snapshot.population.metrics.meanHousingBurden=999;}catch{}
   const detached=first.observe().meanHousingBurden!==999;
   first.step(60);second.step(60);const seeded=JSON.stringify(first.serialize())===JSON.stringify(second.serialize());
   first.pause();const paused=first.serialize();first.step(60);const held=JSON.stringify(paused)===JSON.stringify(first.serialize());first.resume();
   const metricsBefore=first.observe(),minute=first.clock.minute;first.applyScenario({id:'rent-input',parameters:{rentMultiplier:1.5}});const metricsAfter=first.observe();
   let outcomeRejected=false;try{first.applyScenario({averageCommute:-8});}catch{outcomeRejected=true;}
   return{readOnly:JSON.stringify(before)===JSON.stringify(after),detached,seeded,held,input:first.parameters.rentMultiplier,metricsBefore,metricsAfter,minute,afterMinute:first.clock.minute,outcomeRejected,ownership:first.ownership};
  }finally{first.destroy();second.destroy();}
 });
 expect(result.readOnly).toBe(true);expect(result.detached).toBe(true);expect(result.seeded).toBe(true);expect(result.held).toBe(true);
 expect(result.input).toBe(1.5);expect(result.afterMinute).toBe(result.minute);expect(result.metricsAfter).toEqual(result.metricsBefore);expect(result.outcomeRejected).toBe(true);
 expect(result.ownership.legacyWrites).toBe(false);expect(result.ownership.parityGatePassed).toBe(false);
});

test('opt-in comparison uses an actual module worker, follows committed legacy minutes and exposes detached worker state',async({page})=>{
 test.setTimeout(120000);const workers=await observeWorld(page),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world?demo=1&people=80&shadow=1&living=0&renderer=webgl&quality=LOW&lat=29.7286&lng=-95.4746');
 await page.waitForFunction(()=>Boolean(window.hblShadowComparison)&&Boolean(window.__runtimeQA),null,{timeout:90000});
 await page.locator('#speeds [data-s="0"]').click();
 await page.evaluate(()=>window.hblShadowComparison.ready);
 await expect.poll(()=>page.evaluate(()=>{window.hblShadowComparison.refresh();return window.hblShadowComparison.getReport()?.gates?.clockAligned;}),{timeout:30000}).toBe(true);
 const baseline=await page.evaluate(()=>({visible:window.__runtimeQA(),shadow:window.hblShadowComparison.getSnapshot(),report:window.hblShadowComparison.getReport(),context:window.__runtimeContext()}));
 expect(workers.filter(url=>url.includes('/runtime/shadow.worker.js'))).toHaveLength(1);
 expect(baseline.shadow.clock.minute).toBe(baseline.visible.minute);expect(baseline.shadow.metrics.syntheticPopulation).toBe(80);expect(baseline.visible.people).toHaveLength(80);
 expect(baseline.shadow.geography.buildings).toEqual(baseline.context.buildings);expect(baseline.shadow.geography.districts).toEqual(baseline.context.districts);expect(baseline.report.authority).toContain('legacy');expect(baseline.report.gates.automaticCutover).toBe(false);expect(baseline.shadow.ownership.legacyWrites).toBe(false);
 expect(baseline.report.rows.find(row=>row.id==='moodUtility').delta).toBeNull();
 await page.waitForTimeout(500);const paused=await page.evaluate(()=>({visible:window.__runtimeQA(),shadow:window.hblShadowComparison.getSnapshot()}));expect(paused.visible).toEqual(baseline.visible);expect(paused.shadow).toEqual(baseline.shadow);
 const detached=await page.evaluate(async()=>{const host=window.hblShadowComparison,snapshot=host.getSnapshot(),minute=snapshot.clock.minute,report=host.getReport();report.authority='tampered';const reportIsolated=host.getReport().authority!=='tampered';snapshot.metrics.syntheticPopulation=-999;const immediatePopulation=host.getSnapshot().metrics.syntheticPopulation;snapshot.metrics.syntheticPopulation=80;return{minute:host.getSnapshot().clock.minute,population:immediatePopulation,expectedMinute:minute,reportIsolated};});
 expect(detached.minute).toBe(detached.expectedMinute);expect(detached.population).toBe(80);expect(detached.reportIsolated).toBe(true);
 await page.locator('#speeds [data-s="1"]').click();await expect.poll(()=>page.evaluate(()=>window.__runtimeQA().minute),{timeout:10000}).toBeGreaterThan(baseline.visible.minute);await page.locator('#speeds [data-s="0"]').click();
 await expect.poll(()=>page.evaluate(()=>{window.hblShadowComparison.refresh();return window.hblShadowComparison.getReport()?.gates?.clockAligned;}),{timeout:30000}).toBe(true);
 expect(await page.evaluate(()=>window.hblShadowComparison.getSnapshot().clock.minute)).toBe(await page.evaluate(()=>window.__runtimeQA().minute));
 await expect(page.getByTestId('shadow-comparison')).toBeVisible();expect(errors).toEqual([]);
});

test('culture panel reads the paused legacy clock and schedules an explicit temporary scenario',async({page})=>{
 test.setTimeout(120000);await observeWorld(page);await page.goto('/world?demo=1&people=30&living=0&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>Boolean(window.__runtimeCulture?.())&&Boolean(window.hblCulturePanel),null,{timeout:90000});
 await page.locator('#speeds [data-s="0"]').click();await page.getByTestId('culture-button').click();const panel=page.getByTestId('culture-panel');await expect(panel).toBeVisible();
 await expect(panel.locator('[data-culture-scenes] article')).toHaveCount(8);
 const before=await page.evaluate(()=>window.__runtimeCulture().serialize());await page.waitForTimeout(400);expect(await page.evaluate(()=>window.__runtimeCulture().serialize())).toEqual(before);
 await panel.locator('details').first().locator('summary').click();await panel.locator('[data-culture-absurd]').uncheck();
 await expect.poll(()=>page.evaluate(()=>window.__runtimeCulture().snapshot().parameters.absurdEventsEnabled)).toBe(false);
 await panel.locator('[data-culture-event]').selectOption('inflatable-bear');await panel.locator('[data-culture-schedule]').click();
 await expect(panel.locator('[data-culture-active]')).toContainText('Giant inflatable bear');
 const event=await page.evaluate(()=>window.__runtimeCulture().snapshot().activeEvents.find(row=>row.type==='inflatable-bear'));
 expect(event.source).toBe('manual');expect(event.endMinute-event.startMinute).toBe(90);expect(event.effects.roads).toBe(.7);expect(await page.evaluate(()=>window.__runtimeCulture().snapshot().minute)).toBe(before.minute);
});

test('law catalog compares detached reviewed proposals and distinguishes potential scope from recorded changes',async({page})=>{
 test.setTimeout(180000);await observeWorld(page);await page.goto('/world?demo=1&people=80&living=0&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>Boolean(window.hblLawPanel)&&Boolean(window.__runtimeQA),null,{timeout:90000});await page.locator('#speeds [data-s="0"]').click();if(await page.locator('#top').getAttribute('open')!==null)await page.locator('#top > summary').click();await page.getByTestId('law-panel-button').click();const panel=page.getByTestId('law-panel');await expect(panel).toBeVisible();await expect(panel.locator('[data-law-id]')).toHaveCount(90);
 const before=await page.evaluate(()=>window.__runtimeQA());await panel.getByLabel('Find a law',{exact:true}).fill('21');await panel.locator('[data-law-id="law-21"]').click();
 await expect(panel.getByRole('table')).toContainText('Without law',{timeout:60000});await expect(panel.getByRole('table')).toContainText('With law');
 const selection=await page.evaluate(()=>window.hblLawPanel.getSelection());expect(await panel.getByLabel('Plan idea',{exact:true}).inputValue()).toBe(selection.text);
 await panel.getByRole('button',{name:'Relevant institutions',exact:true}).click();const potential=await page.evaluate(()=>window.hblLawWorldLayer.getStats());expect(potential.mode).toBe('potential');expect(potential.buildings).toBeGreaterThan(0);await expect(panel).toContainText('Potential institution scope');
 await panel.getByRole('button',{name:'Highlight modeled changes',exact:true}).click();expect(await page.evaluate(()=>window.hblLawWorldLayer.getStats().mode)).toBe('recorded');
 await panel.getByLabel('Find a law',{exact:true}).fill('26');await panel.locator('[data-law-id="law-26"]').click();await expect(panel.getByRole('status')).toContainText('Effects unavailable');await expect(panel.getByRole('table')).toContainText('No recorded numerical comparison');
 expect(await page.evaluate(()=>window.__runtimeQA())).toEqual(before);
});

test('legacy compatibility shares household cash, pays one voucher and carries actual annual sample state deterministically',async({page})=>{
 test.setTimeout(60000);await page.route('**/__legacy-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Actual legacy compatibility QA</title>'}));await page.goto('/__legacy-qa');
 const result=await page.evaluate(async()=>{
  const {buildTown}=await import('/world/gen.js'),{createWorld,WALK_M_PER_MIN}=await import('/world/sim.js'),{simulateYear}=await import('/world/experiment.js');
  const fixture=()=>{const town=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:4});for(const p of town.people)p.householdId='shared';return town;};
  const world=createWorld(fixture(),{runSeed:42});world.people[0].money=80;world.people[1].money-=15;const shared=world.people.every(p=>p.money===65)&&world.households[0].cash===65;
  world.voucherMonthly=20;const first=world.sampleVoucher('representative-year'),second=world.sampleVoucher('representative-year'),voucherCash=world.households[0].cash;
  world.households[0].cash=10000;world.people[0].needs.energy=37;const saved=world.captureState(),restored=createWorld(fixture(),{runSeed:'42:year:1',state:saved});
  const carry={cash:restored.households[0].cash,energy:restored.people[0].needs.energy};
  const input={town:fixture(),proposalIds:[],year:1,packageLabel:'QA',seed:42,yearStartMs:0,stormSeverityValue:0};
  const a=await simulateYear({...input,longitudinalState:saved}),b=await simulateYear({...input,longitudinalState:saved}),fresh=await simulateYear(input);
  const speedBefore=WALK_M_PER_MIN;world.speedMult=3;const walker=world.people[0];Object.assign(walker,{x:0,z:0,mode:"moving",travelMode:"walk",transitWaitMinutesRemaining:0,path:[[1000,0]],pathI:0,tx:1000,tz:0,target:walker.home,tripStartedMinute:world.t});world.step(1);const actualWalkDistance=Math.hypot(walker.x,walker.z);
  return{shared,first,second,voucherCash,carry,deterministic:JSON.stringify(a.endState)===JSON.stringify(b.endState),carriedCash:a.endState.households[0].cash,freshCash:fresh.endState.households[0].cash,methods:a.methods,actualWalkDistance,speedBefore,speedAfter:world.parameters?.walkMetersPerMinute??WALK_M_PER_MIN};
 });
 expect(result.shared).toBe(true);expect(result.first).toBe(1);expect(result.second).toBe(0);expect(result.voucherCash).toBe(85);expect(result.carry).toEqual({cash:10000,energy:37});expect(result.deterministic).toBe(true);expect(result.carriedCash).toBeGreaterThan(result.freshCash);expect(result.methods.restoredPreviousSample).toBe(true);expect(result.methods.simulatedMinutes).toBe(7200);expect(result.methods.annualized).toBe(false);expect(result.methods.runSeed).toBe('42:year:1');expect(result.speedBefore).toBe(40);expect(result.speedAfter).toBe(40);expect(result.actualWalkDistance).toBeCloseTo(40,6);
});

test('actual Living worker accepts paused weather inputs without reset, updates mechanisms and replays weather history',async({page})=>{
 test.setTimeout(120000);const workers=[];page.on('worker',worker=>workers.push(worker.url()));await page.route('**/__living-weather-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Actual Living weather worker</title>'}));await page.goto('/__living-weather-qa');
 const result=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');const runtime=createPopulationRuntime({config:{population:120,seed:42},workerCount:1,stepMinutes:15,worldContext:{districts:[{id:'a',x:0,z:0,transit:1,services:1},{id:'b',x:1200,z:0,transit:1,services:1}]}});
  const residents=snapshot=>snapshot.visibleAgents.map(p=>({id:p.id,x:p.x,z:p.z,needs:p.needs}));
  try{
   await runtime.ready;runtime.pause();const weather=runtime.getWeatherSimulation();await weather.configure({automatic:false,temperatureC:22,rainIntensity:0,stormIntensity:0});const before=structuredClone(runtime.getSnapshot());
   await weather.configure({temperatureC:42});const hot=structuredClone(runtime.getSnapshot());await weather.configure({rainIntensity:1});const rain=structuredClone(runtime.getSnapshot());
   const person=await runtime.inspectPerson(rain.visibleAgents[0].id),walk=person.currentAlternatives.alternatives.find(row=>row.id==='walk');
   await new Promise(resolve=>setTimeout(resolve,100));const held=structuredClone(runtime.getSnapshot());await runtime.stepToTime(480);await runtime.step();const stepped=structuredClone(runtime.getSnapshot());
   const future=await runtime.runExperiments({runs:1,horizonDays:1}).ready,row=future.rows[0];if(row.status!=='completed')throw Error('Actual future did not complete: '+JSON.stringify(row));
   const replay=await runtime.replayFuture(row,future.manifest),futurePerson=await runtime.inspectFutureEntity(row,future.manifest,{kind:'person',id:replay.visibleAgents[0].id});
   return{before:{minute:before.minute,tick:before.runtime.tick,id:before.runtime.id,revision:before.runtime.revision,residents:residents(before),power:before.metrics.electricityDemandKw},hot:{minute:hot.minute,tick:hot.runtime.tick,id:hot.runtime.id,revision:hot.runtime.revision,residents:residents(hot),power:hot.metrics.electricityDemandKw},rain:{minute:rain.minute,residents:residents(rain)},held:{minute:held.minute,residents:residents(held)},walk,stepped:{minute:stepped.minute,trips:stepped.metrics.trips,residents:residents(stepped)},manifest:future.manifest,replay:{weather:replay.weather.sourceSnapshot,metrics:replay.metrics},recorded:row.summary.metrics,futureWalk:futurePerson.currentAlternatives.alternatives.find(row=>row.id==='walk')};
  }finally{runtime.destroy();}
 });
 expect(workers.filter(url=>url.includes('/population/population.worker.js')).length).toBeGreaterThanOrEqual(2);
 expect(result.hot.minute).toBe(result.before.minute);expect(result.hot.tick).toBe(result.before.tick);expect(result.hot.id).toBe(result.before.id);expect(result.hot.revision).toBe(result.before.revision);expect(result.hot.residents).toEqual(result.before.residents);expect(result.hot.power).toBeGreaterThan(result.before.power);
 expect(result.rain.residents).toEqual(result.before.residents);expect(result.held).toEqual(result.rain);expect(result.walk.components.weatherComfort).toBeLessThan(0);
 expect(result.stepped.minute).toBe(495);expect(result.stepped.trips).toBeGreaterThan(0);expect(result.stepped.residents).not.toEqual(result.before.residents);
 expect(result.manifest.weatherTimeline).toHaveLength(3);expect(result.manifest.weatherTimeline.every(row=>row.minute===0)).toBe(true);expect(result.replay.weather.temperatureC).toBe(42);expect(result.replay.weather.rainIntensity).toBe(1);expect(result.replay.metrics).toEqual(result.recorded);expect(result.futureWalk.components.weatherComfort).toBeLessThan(0);
});
