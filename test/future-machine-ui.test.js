import {test,expect} from 'bun:test';
import {clampMonth,calendarLabel,formatMeasurement,metricPresentation} from '../world/future-machine/ui/model.js';
test('shared calendar includes exact Month 0 and Month 120',()=>{expect(calendarLabel(0)).toBe('Jan 2026');expect(calendarLabel(60)).toBe('Jan 2031');expect(calendarLabel(120)).toBe('Jan 2036');expect(calendarLabel(11)).toBe('Dec 2026');});
test('timeline clamps invalid and out of range input',()=>{expect(clampMonth(-1)).toBe(0);expect(clampMonth(121)).toBe(120);expect(clampMonth(NaN)).toBe(0);expect(clampMonth(1.7)).toBe(2);});
test('measurements preserve zero and units, never coerce missing data to zero',()=>{expect(formatMeasurement(0,'homes')).toBe('0 homes');for(const value of [null,undefined,NaN,Infinity,'4'])expect(formatMeasurement(value)).toBe('Unavailable');});
test('metrics use matched A/B values, explicit unavailable, and no invented delta',()=>{expect(metricPresentation({baseline:0,intervention:5,unit:'homes'}).delta).toBe('+5 homes');expect(metricPresentation({baseline:4,intervention:4,unit:'min/trip'}).delta).toBe('0 min/trip');expect(metricPresentation({baseline:5,intervention:3,unit:'USD'}).delta).toBe('-2 USD');expect(metricPresentation({baseline:3,intervention:null,reason:'No recorded trips'})).toEqual({baseline:'Unavailable',intervention:'Unavailable',delta:'Unavailable',detail:'No recorded trips'});expect(metricPresentation({baseline:0,intervention:0,available:false}).delta).toBe('Unavailable');});

test.skipIf(!process.env.HBL_FM_BROWSER)('Chromium controls, loading, failure, keyboard, mobile and cleanup',async()=>{
  const {chromium}=await import(process.env.HBL_PLAYWRIGHT_MODULE || '@playwright/test');
  const root=new URL('../',import.meta.url).pathname;
  const server=Bun.serve({port:0,fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/')return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/world/future-machine/ui/styles.css"><body style="margin:0">',{headers:{'content-type':'text/html'}});
    if(!path.startsWith('/world/future-machine/ui/')&&!['/world/future-machine/contracts.js','/world/city/contracts.js'].includes(path))return new Response('',{status:404});
    return new Response(Bun.file(root+path));
  }});
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`http://127.0.0.1:${server.port}`);
    await page.evaluate(async()=>{
      const {createUI}=await import('/world/future-machine/ui/index.js');window.calls=[];
      window.ui=createUI(document.body,{onDemo:()=>calls.push(['demo']),onDemoPause:()=>calls.push(['demoPause']),onMetric:key=>calls.push(['metric',key]),onRun:recipe=>calls.push(['run',recipe]),onMonth:month=>calls.push(['month',month]),onPlay:value=>calls.push(['play',value]),onMode:mode=>calls.push(['mode',mode]),onDirector:()=>calls.push(['director']),onShare:()=>calls.push(['share']),onExport:()=>calls.push(['export']),onCancel:()=>calls.push(['cancel'])});
      ui.update({status:'idle'});
      document.querySelector('.fm-demo-play').click();
      window.idleDemoEnabled=!document.querySelector('.fm-demo-play').disabled;
      ui.update({recipe:{seed:42,months:120,intervention:{type:'housing',amount:24,cost:1000000,districtId:'d1'}},status:'ready',month:0,frame:{baseline:{state:{households:[{id:'h1',savings:0}]}},plan:{state:{households:[{id:'h1',savings:3}]}}},diff:{available:true,metrics:{housingUnits:{baseline:0,plan:5,unit:'homes'},capitalSpending:{baseline:0,plan:1000000,unit:'USD cumulative'}},physicalCount:0,changedCount:1}});
    });
    expect(await page.evaluate(()=>idleDemoEnabled&&calls.some(call=>call[0]==='demo'))).toBe(true);
    await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
    await page.getByRole('button',{name:'WHY · City spending',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='metric').map(call=>call[1]))).toEqual(['housingUnits','capitalSpending']);
    await page.getByRole('button',{name:'Differences only',exact:true}).click();
    expect(await page.evaluate(()=>calls.some(call=>call[0]==='mode'&&call[1]==='difference'))).toBe(true);
    await page.evaluate(()=>ui.update({demo:{status:'playing',paused:false,caption:'Matched starts',elapsedMs:1200},provenance:{seed:42,modelVersion:'test.v1',experimentId:'run-42'}}));
    expect(await page.locator('.fm-run-provenance').textContent()).toContain('SEED 42 · MODEL test.v1 · RUN run-42');
    await page.getByRole('button',{name:'Pause demo',exact:true}).click();
    await page.evaluate(()=>ui.update({demo:{status:'paused',paused:true,caption:'Explore the city'}}));
    await page.getByRole('button',{name:'Resume demo',exact:true}).click();
    expect(await page.evaluate(()=>calls.filter(call=>call[0]==='demoPause').length)).toBe(2);
    await page.getByRole('slider').focus();await page.keyboard.press('End');
    expect(await page.evaluate(()=>calls.some(call=>call[0]==='month'&&call[1]===120))).toBe(true);
    for(const name of ['Play timelapse','Blink: Future A','Show Me What Changed','Share comparison','Export evidence'])await page.getByRole('button',{name,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.getByRole('button',{name:'Fork City',exact:true}).click();
    expect(await page.evaluate(()=>calls.find(call=>call[0]==='run')[1].intervention.amount)).toBe(24);
    await page.evaluate(()=>ui.update({status:'loading',message:'Bounded run in progress'}));
    expect(await page.getByRole('button',{name:'Fork City',exact:true}).isDisabled()).toBe(true);
    await page.getByRole('button',{name:'Cancel run',exact:true}).click();
    expect(await page.evaluate(()=>calls.some(call=>call[0]==='cancel'))).toBe(true);
    await page.evaluate(()=>ui.update({status:'error',error:'Missing replay snapshot'}));
    expect(await page.getByRole('alert').textContent()).toContain('Missing replay');
    await page.evaluate(()=>ui.update({status:'ready',error:null,shareURL:'javascript:alert(1)'}));
    expect(await page.locator('.fm-share-link').isVisible()).toBe(false);
    await page.setViewportSize({width:1440,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:'/tmp/future-machine-ui-desktop.png',fullPage:true});
    await page.evaluate(()=>ui.dispose());expect(await page.locator('.fm-ui').count()).toBe(0);
  }finally{await browser?.close();server.stop(true);}
},30000);
