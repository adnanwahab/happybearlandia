import {test,expect} from 'bun:test';
import {clampMonth,calendarLabel,formatMeasurement,metricPresentation,metricSemantics,householdObservation,householdSummary,comparisonMetric} from '../world/future-machine/ui/model.js';
import {metricDelta} from '../world/future-machine/diff/core.js';

test('overflowing paired measurements remain unavailable rather than displaying Infinity',()=>{
  const comparison=metricDelta(-Number.MAX_VALUE,Number.MAX_VALUE,'USD');
  expect(comparison.status).toBe('missing');
  expect(comparison.delta).toBeNull();
  const metric={baseline:comparison.baseline,intervention:comparison.plan,unit:comparison.unit};
  expect(metricPresentation(metric).delta).toBe('Unavailable');
  expect(metricSemantics('spending',metric).tone).toBe('unavailable');
});
test('shared calendar includes exact Month 0 and Month 120',()=>{expect(calendarLabel(0)).toBe('Jan 2026');expect(calendarLabel(60)).toBe('Jan 2031');expect(calendarLabel(120)).toBe('Jan 2036');expect(calendarLabel(11)).toBe('Dec 2026');});
test('timeline clamps invalid and out of range input',()=>{expect(clampMonth(-1)).toBe(0);expect(clampMonth(121)).toBe(120);expect(clampMonth(NaN)).toBe(0);expect(clampMonth(1.7)).toBe(2);});
test('measurements preserve zero and units, never coerce missing data to zero',()=>{expect(formatMeasurement(0,'homes')).toBe('0 homes');for(const value of [null,undefined,NaN,Infinity,'4'])expect(formatMeasurement(value)).toBe('Unavailable');});
test('metrics use matched A/B values, explicit unavailable, and no invented delta',()=>{expect(metricPresentation({baseline:0,intervention:5,unit:'homes'}).delta).toBe('+5 homes');expect(metricPresentation({baseline:4,intervention:4,unit:'min/trip'}).delta).toBe('0 min/trip');expect(metricPresentation({baseline:5,intervention:3,unit:'USD'}).delta).toBe('-2 USD');expect(metricPresentation({baseline:3,intervention:null,reason:'No recorded trips'})).toEqual({baseline:'Unavailable',intervention:'Unavailable',delta:'Unavailable',detail:'No recorded trips'});expect(metricPresentation({baseline:0,intervention:0,available:false}).delta).toBe('Unavailable');});

test('metric direction does not invent welfare, and tiny nonzero values survive formatting',()=>{
  expect(metricSemantics('homes',{baseline:24,intervention:24}).tone).toBe('neutral');
  expect(metricSemantics('spending',{baseline:0,intervention:1000000})).toEqual({tone:'cost',label:'Additional capital cost'});
  expect(metricSemantics('rent',{baseline:1200,intervention:1100}).tone).toBe('neutral');
  expect(metricSemantics('homes',{baseline:24,intervention:0}).tone).toBe('change');
  expect(metricSemantics('spending',{baseline:24,intervention:null}).tone).toBe('unavailable');
  expect(metricSemantics('homes',{baseline:0,intervention:1,available:false}).tone).toBe('unavailable');
  expect(formatMeasurement(1000000,'USD cumulative')).toBe('1,000,000 USD total');
  expect(formatMeasurement(0.000001,'USD')).toBe('0.000001 USD');
  expect(metricPresentation({baseline:0,intervention:-0.000001,unit:'USD'}).delta).toBe('-0.000001 USD');
});
test('household rent and burden require an exact reciprocal occupied-unit identity',()=>{
  const h={id:'h1',unitId:'u1',income:2000,savings:0},u={id:'u1',householdId:'h1',rent:500,status:'occupied'};
  expect(householdObservation(h,[u])).toEqual({income:2000,savings:0,rent:500,burden:.25,unitId:'u1'});
  for(const units of [[],[u,u],[{...u,householdId:'other'}],[{...u,status:'available'}],[{...u,rent:NaN}]])expect(householdObservation(h,units).rent).toBeNull();
  expect(householdObservation({...h,income:0},[u]).burden).toBeNull();
  expect(householdObservation(h,[{...u,rent:0}]).rent).toBe(0);
  const text=householdSummary({id:'h1',baseline:h,plan:null,baselineHousing:householdObservation(h,[u])});
  expect(text).toContain('missing from one future');expect(text).toContain('500 USD/month');expect(text).toContain('25 %');expect(text).toContain('savings 0 USD');expect(text).toContain('rent Unavailable');
});

test('negative cost and overflow deltas retain truthful direction and availability',()=>{
  expect(metricSemantics('spending',{baseline:100,intervention:0})).toEqual({tone:'cost',label:'Lower capital spending; service benefit not established'});
  const overflow={baseline:-Number.MAX_VALUE,intervention:Number.MAX_VALUE,unit:'USD'};
  expect(metricPresentation(overflow).delta).toBe('Unavailable');
  expect(metricSemantics('spending',overflow).tone).toBe('unavailable');
});

test.skipIf(!process.env.HBL_FM_BROWSER)('Chromium controls, loading, failure, keyboard, mobile and cleanup',async()=>{
  const {chromium}=await import(process.env.HBL_PLAYWRIGHT_MODULE || '@playwright/test');
  const root=new URL('../',import.meta.url).pathname;
  const server=Bun.serve({port:0,fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/')return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/world/future-machine/ui/styles.css"><body style="margin:0">',{headers:{'content-type':'text/html'}});
    if(!path.startsWith('/world/')&&!path.startsWith('/shared/'))return new Response('',{status:404});
    return new Response(Bun.file(root+path));
  }});
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}`);
    await page.evaluate(async()=>{
      const {createUI}=await import('/world/future-machine/ui/index.js');window.calls=[];
      window.ui=createUI(document.body,{onReset:()=>calls.push(['reset']),onConfigure:recipe=>calls.push(['configure',recipe]),onDemo:()=>calls.push(['demo']),onDemoPause:()=>calls.push(['demoPause']),onMetric:key=>calls.push(['metric',key]),onRun:recipe=>calls.push(['run',recipe]),onMonth:month=>calls.push(['month',month]),onPlay:value=>calls.push(['play',value]),onMode:mode=>calls.push(['mode',mode]),onDirector:()=>calls.push(['director']),onShare:()=>calls.push(['share']),onExport:()=>calls.push(['export']),onCancel:()=>calls.push(['cancel'])});
      ui.update({status:'idle'});
      document.querySelector('.fm-demo-play').click();
      window.idleDemoEnabled=!document.querySelector('.fm-demo-play').disabled;
      ui.update({recipe:{seed:42,months:120,intervention:{type:'housing',amount:24,cost:1000000,districtId:'d1'}},status:'ready',month:0,frame:{baseline:{state:{households:[{id:'h1',savings:0}]}},plan:{state:{households:[{id:'h1',savings:3}]}}},diff:{available:true,metrics:{housingUnits:{baseline:0,plan:5,unit:'homes'},capitalSpending:{baseline:0,plan:1000000,unit:'USD cumulative'}},physicalCount:0,changedCount:1}});
    });
    const badges=page.locator('.fm-provenance-badge');
    expect(await badges.count()).toBe(3);
    for(const badge of await badges.all()){
      const description=await badge.getAttribute('title');
      expect(description).toContain('Category:');expect(description).toContain('Source:');
    }
    expect(await badges.first().getAttribute('title')).toContain('Category: Modeled.');
    await badges.first().focus();
    expect(await badges.first().getAttribute('aria-label')).toContain('Monthly City recorded');
    expect(await page.evaluate(()=>idleDemoEnabled&&calls.some(call=>call[0]==='demo'))).toBe(true);
    await page.evaluate(()=>ui.update({diff:{available:true,changedCount:0,physicalCount:0,metrics:{housingUnits:{baseline:24,plan:24,delta:0,unit:'homes'}}}}));
    expect(await page.locator('.fm-arm-heading').allTextContents()).toEqual(['WITHOUT PLAN · Identical starting state','WITH PLAN · Identical starting state']);
    expect(await page.locator('.fm-arm-inputs').count()).toBe(2);
    await page.evaluate(()=>ui.update({diff:{available:false,changedCount:0,physicalCount:0,metrics:{housingUnits:{baseline:24,plan:null,delta:null,unit:'homes'}}}}));
    expect(await page.locator('.fm-legends').textContent()).not.toContain('Identical');
    await page.evaluate(()=>ui.update({diff:{available:true,changedCount:0,physicalCount:0,metrics:{housingUnits:{baseline:24,plan:24,delta:0,unit:'homes'},capitalSpending:{baseline:0,plan:1000000,delta:1000000,unit:'USD cumulative'}}}}));
    expect(await page.locator('.fm-legends').textContent()).not.toContain('Identical');
    await page.evaluate(()=>ui.update({month:1}));
    expect(await page.locator('.fm-legends').textContent()).not.toContain('Identical');
    await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
    await page.getByRole('button',{name:'WHY · City spending',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='metric').map(call=>call[1]))).toEqual(['housingUnits','capitalSpending']);
    await page.getByRole('button',{name:'Difference-only',exact:true}).click();
    expect(await page.evaluate(()=>calls.some(call=>call[0]==='mode'&&call[1]==='difference'))).toBe(true);
    await page.evaluate(()=>ui.update({demo:{status:'playing',paused:false,caption:'Matched starts',elapsedMs:1200},provenance:{seed:42,modelVersion:'test.v1',experimentId:'run-42'}}));
    expect(await page.locator('.fm-run-provenance').textContent()).toContain('SEED 42 · MODEL test.v1 · RUN run-42');
    await page.getByRole('button',{name:'Pause demo',exact:true}).click();
    await page.evaluate(()=>ui.update({demo:{status:'paused',paused:true,caption:'Explore the city'}}));
    await page.getByRole('button',{name:'Resume demo',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='demoPause').length)).toBe(2);
    const explanation=page.locator('.fm-explanation');
    expect(await explanation.getAttribute('open')).toBeNull();
    await explanation.locator('summary').focus();await page.keyboard.press('Enter');
    expect(await explanation.getAttribute('open')).not.toBeNull();
    expect(await explanation.textContent()).toContain('not predictions of real rents');
    expect(await explanation.textContent()).toContain('not independently verified stored checkpoints');
    expect(await explanation.getByRole('link').count()).toBe(5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await explanation.locator('summary').focus();await page.keyboard.press('Space');
    expect(await explanation.getAttribute('open')).toBeNull();
    await page.getByRole('slider').focus();await page.keyboard.press('End');
    expect(await page.evaluate(()=>calls.some(call=>call[0]==='month'&&call[1]===120))).toBe(true);
    for(const name of ['Play timelapse','Blink: Future A','Show Me What Changed','Copy comparison link','Export evidence'])await page.getByRole('button',{name,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const seed=page.getByLabel('Seed for next run',{exact:false});
    await seed.fill('0');
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='configure').at(-1)[1].seed)).toBe(0);
    await page.evaluate(()=>ui.update({month:16,recipe:{seed:42,months:120,intervention:{type:'housing',amount:24,cost:1000000,districtId:'d1'}}}));
    expect(await seed.inputValue()).toBe('0');
    expect(await page.locator('.fm-run-provenance').textContent()).toContain('SEED 42');
    for(const invalid of ['', 'NaN','1.5','-1','4294967296']){
      await seed.fill(invalid);
      expect(await seed.getAttribute('aria-invalid')).toBe('true');
      expect(await page.locator('.fm-seed-error').isVisible()).toBe(true);
      expect(await page.evaluate(()=>calls.filter(call=>call[0]==='configure').at(-1)[1].seed)).toBe(0);
    }
    await page.getByRole('button',{name:'Fork City',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='run').length)).toBe(0);
    await page.evaluate(()=>ui.update({month:17,recipe:{seed:42,months:120,intervention:{type:'housing',amount:24,cost:1000000,districtId:'d1'}}}));
    expect(await seed.inputValue()).toBe('4294967296');
    await seed.fill('0');
    await page.getByRole('button',{name:'Fork City',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='run').at(-1)[1].seed)).toBe(0);
    await seed.fill('4294967295');
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='configure').at(-1)[1].seed)).toBe(4294967295);
    await page.locator('.fm-setup select').nth(1).selectOption('baseline');
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='configure').at(-1)[1].intervention)).toBeNull();
    await page.evaluate(()=>ui.update({month:18}));
    expect(await page.locator('.fm-setup select').nth(1).inputValue()).toBe('baseline');
    await page.locator('.fm-setup select').nth(1).selectOption('housing');
    await page.getByRole('button',{name:'Fork City',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='run').at(-1)[1].intervention.amount)).toBe(24);
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='run').at(-1)[1].seed)).toBe(4294967295);
    await page.evaluate(()=>ui.update({originalRecipe:{seed:17,months:120,households:51,intervention:{type:'housing',amount:7,cost:800,districtId:'d1',delay:3,compliance:.5}}}));
    await seed.fill('invalid');
    const runCount=await page.evaluate(()=>calls.filter(call=>call[0]==='run').length);
    await page.getByTestId('future-machine-reset').click();
    expect(await seed.inputValue()).toBe('17');
    expect(await seed.getAttribute('aria-invalid')).toBe('false');
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='run').length)).toBe(runCount);
    await page.getByRole('button',{name:'Fork City',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='run').at(-1)[1])).toEqual({seed:17,months:120,households:51,intervention:{type:'housing',amount:7,cost:800,districtId:'d1',delay:3,compliance:.5}});
    await page.evaluate(()=>ui.update({status:'loading',message:'Bounded run in progress'}));
    expect(await page.getByTestId('future-machine-reset').isDisabled()).toBe(true);
    expect(await page.getByRole('button',{name:'Fork City',exact:true}).isDisabled()).toBe(true);
    await page.getByRole('button',{name:'Cancel run',exact:true}).click();
    expect(await page.evaluate(()=>calls.some(call=>call[0]==='cancel'))).toBe(true);
    await page.evaluate(()=>ui.update({status:'error',error:'Missing replay snapshot'}));
    expect(await page.getByRole('alert').textContent()).toContain('Missing replay');
    await page.evaluate(()=>ui.update({status:'ready',error:null,shareURL:'javascript:alert(1)'}));
    expect(await page.locator('.fm-share-link').isVisible()).toBe(false);
    await page.evaluate(()=>ui.update({diff:{available:true,metrics:{housingUnits:{baseline:24,plan:24,unit:'homes'},meanRent:{baseline:1200,plan:1100,unit:'USD/month'},capitalSpending:{baseline:0,plan:1000000,unit:'USD cumulative'}},physicalCount:0,changedCount:0},frame:{baseline:{state:{households:[{id:'h1',unitId:'u1',income:2000,savings:0}],units:[{id:'u1',householdId:'h1',status:'occupied',rent:500}]}},plan:{state:{households:[{id:'h1',unitId:'u1',income:2000,savings:3}],units:[]}}}}));
    expect(await page.locator('.fm-card').evaluateAll(cards=>cards.map(card=>card.dataset.tone))).toEqual(['neutral','neutral','cost']);
    expect(await page.locator('.fm-card').nth(2).textContent()).toContain('Additional capital cost');
    expect(await page.locator('.fm-card').nth(1).textContent()).toContain('not incumbent rent savings');
    expect(await page.locator('.fm-inspectors').textContent()).toContain('rent 500 USD/month');
    expect(await page.locator('.fm-inspectors').textContent()).toContain('rent Unavailable');
    expect(await page.locator('.fm-card').evaluateAll(cards=>getComputedStyle(cards[0].querySelector('strong')).color!==getComputedStyle(cards[2].querySelector('strong')).color)).toBe(true);
    expect(await page.locator('.fm-metric-limits').textContent()).toContain('not an uncertainty interval');
    await page.screenshot({path:'/tmp/future-machine-ui-semantic-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:'/tmp/future-machine-ui-semantic-desktop.png',fullPage:true});
    await page.evaluate(()=>ui.update({diff:{available:true,metrics:{housingUnits:{baseline:0,plan:null,unit:'homes'}},physicalCount:0,changedCount:0}}));
    expect(await page.locator('.fm-card').first().getAttribute('data-tone')).toBe('unavailable');
    expect(await page.getByRole('button',{name:'WHY · Homes',exact:true}).isDisabled()).toBe(true);
    await page.evaluate(()=>ui.update({diff:{available:false,metrics:{housingUnits:{baseline:36,plan:60,unit:'homes',status:'available'},meanRent:{baseline:100,plan:90,unit:'USD/month',status:'missing',reason:'Rent observation missing'},capitalSpending:{baseline:0,plan:100,unit:'USD cumulative',available:false,reason:'Cost record unavailable'}},physicalCount:1,changedCount:1}}));
    expect(await page.locator('.fm-card').first().textContent()).toContain('+24 homes');
    expect(await page.locator('.fm-card').nth(1).textContent()).toContain('Rent observation missing');
    expect(await page.locator('.fm-card').nth(2).textContent()).toContain('Cost record unavailable');
    expect(await page.getByRole('button',{name:'WHY · City spending',exact:true}).isDisabled()).toBe(true);
    await page.evaluate(()=>ui.dispose());expect(await page.locator('.fm-ui').count()).toBe(0);
  }finally{await browser?.close();server.stop(true);}
},30000);

test('recorded metric adapter preserves missing status, reason, zero and signed cost',()=>{
  for(const unavailable of [{status:'missing'},{available:false}]) {
    const metric=comparisonMetric({baseline:0,plan:100,unit:'USD cumulative',reason:'Ledger unavailable',...unavailable});
    expect(metricPresentation(metric).delta).toBe('Unavailable');
    expect(metricPresentation(metric).detail).toBe('Ledger unavailable');
    expect(metricSemantics('spending',metric).tone).toBe('unavailable');
  }
  expect(metricPresentation(comparisonMetric({baseline:36,plan:36,unit:'homes',status:'available'})).delta).toBe('0 homes');
  expect(metricPresentation(comparisonMetric({baseline:100,plan:0,unit:'USD cumulative',status:'available'})).delta).toBe('-100 USD total');
});

test('first construction cue requires its exact available positive month and preserves missing metrics',async()=>{
 const {firstConstructionLabel}=await import('../world/future-machine/ui/model.js');
 const current={status:'ready',month:16,firstConstruction:{month:16,entity:{collection:'buildings',id:'recorded'}},diff:{available:true,metrics:{housingUnits:{delta:24}}}};
 expect(firstConstructionLabel(current)).toBe('First recorded construction · Month 16 · +24 homes vs without plan');
 for(const patch of [{month:0},{month:15},{month:17},{status:'loading'},{firstConstruction:null},{firstConstruction:{month:0}},{diff:{available:false}}])expect(firstConstructionLabel({...current,...patch})).toBeNull();
 expect(firstConstructionLabel({...current,diff:{available:true}})).toBe('First recorded construction · Month 16');
});

test('provenance categories require explicit metadata and preserve unknown sources',async()=>{
  const {provenancePresentation,MONTHLY_CITY_PROVENANCE}=await import('../world/future-machine/ui/provenance.js');
  for(const category of ['observed','synthetic','modeled']){
    const value=provenancePresentation({category,source:'Recorded fixture source'});
    expect(value.category).toBe(category);expect(value.description).toContain('Source: Recorded fixture source.');
  }
  for(const value of [undefined,{}, {category:'forecast'}, {category:'toString'}])expect(provenancePresentation(value).category).toBe('unknown');
  expect(provenancePresentation({category:'observed'}).description).toContain('Source: Unavailable.');
  const modeled=provenancePresentation(MONTHLY_CITY_PROVENANCE);
  expect(modeled.description).toContain('Category: Modeled.');expect(modeled.description).toContain('Synthetic, uncalibrated');
});
