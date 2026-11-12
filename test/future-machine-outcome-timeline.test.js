import {test,expect} from 'bun:test';
import {buildOutcomeSeries} from '../world/future-machine/ui/outcome-timeline.js';
const snapshot=(month,value)=>({month,metrics:{housingUnits:value}});
test('recorded series preserve identity, zero, exact deltas, gaps and source immutability',()=>{
  const history={baseline:[snapshot(120,5),snapshot(0,0),snapshot(16,2)],plan:[snapshot(0,0),snapshot(16,26),snapshot(120,5.000001)]};
  const before=JSON.stringify(history),rows=buildOutcomeSeries(history,'housingUnits');
  expect(rows.length).toBe(121);expect(rows[0]).toEqual({month:0,baseline:0,plan:0,delta:0,unit:'homes'});expect(rows[16].delta).toBe(24);expect(rows[1].delta).toBeNull();expect(rows[120].delta).toBe(5.000001-5);expect(JSON.stringify(history)).toBe(before);
  expect(buildOutcomeSeries({baseline:[snapshot(1,Infinity)],plan:[snapshot(1,3)]},'housingUnits')[1]).toEqual({month:1,baseline:null,plan:3,delta:null,unit:'homes'});
});
test('reject unsupported metrics, duplicate months and invalid horizons',()=>{
  for(const history of [{baseline:[snapshot(0,1),snapshot(0,2)],plan:[]},{baseline:[snapshot(121,1)],plan:[]},{baseline:Array(122).fill(null),plan:[]}])expect(()=>buildOutcomeSeries(history,'housingUnits')).toThrow();
  expect(()=>buildOutcomeSeries({baseline:[],plan:[]},'inventedFlood')).toThrow();
});
test.skipIf(!process.env.HBL_FM_BROWSER)('renderer-independent outcome timeline works at 320px, keyboard and missing observations',async()=>{
  const {chromium}=await import(process.env.HBL_PLAYWRIGHT_MODULE||'@playwright/test');
  const root=new URL('../',import.meta.url).pathname;

  let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:320,height:720},reducedMotion:'reduce'});page.setDefaultTimeout(5000);
    await page.route('http://outcomes.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#091522">'});
      return route.fulfill({contentType:'application/javascript',body:await Bun.file(root+path).text()});
    });
    await page.goto('http://outcomes.test/');
    await page.evaluate(async()=>{
      const {createOutcomeTimeline}=await import('/world/future-machine/ui/outcome-timeline.js');window.months=[];
      const arm=plan=>Array.from({length:121},(_,month)=>({month,metrics:{housingUnits:month===4?null:30+(plan&&month>=16?24:0),meanRent:plan?999.123456789:1000,capitalSpending:plan?1000000:0}}));
      window.timeline=createOutcomeTimeline(document.body,{history:{baseline:arm(false),plan:arm(true)},onMonth:month=>months.push(month)});
    });
    expect(await page.locator('canvas').count()).toBe(0);
    expect(await page.evaluate(()=>{const point=document.querySelector('svg circle');timeline.update(0);return point===document.querySelector('svg circle');})).toBe(true);
    await page.getByRole('combobox',{name:'Outcome series mode'}).selectOption('delta');
    expect(await page.locator('svg path').count()).toBe(1);
    expect(await page.locator('svg line[data-zero-axis]').count()).toBe(1);
    expect(await page.locator('svg circle').count()).toBe(1);
    expect(await page.getByRole('slider').count()).toBe(0);

    expect(await page.locator('svg').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(180);

    expect(await page.locator('svg path').first().getAttribute('d').then(d=>d.split('M').length-1)).toBe(2);
    expect(await page.evaluate(()=>{try{timeline.update(1.5);return false;}catch{return true;}})).toBe(true);
    await page.locator('svg').evaluate(el=>{const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+(20+16/120*560)/600*r.width}));});
    expect(await page.evaluate(()=>months.at(-1))).toBe(16);expect(await page.locator('.fm-outcome-values').textContent()).toContain('24 homes');
    expect(await page.evaluate(async()=>{
      const chart=document.querySelector('svg'),summary=document.querySelector('.fm-outcome-values');
      let paths=0,announcements=0;
      const observer=new MutationObserver(records=>{paths+=records.filter(r=>r.attributeName==='d').length;announcements+=records.filter(r=>r.target===summary).length;});
      observer.observe(chart,{subtree:true,attributes:true});observer.observe(summary,{childList:true});
      const original=[...chart.querySelectorAll('path')];
      for(let m=0;m<=120;m++)timeline.update(m);
      await Promise.resolve();observer.disconnect();
      return {paths,announcements,same:original.every((p,i)=>p===chart.querySelectorAll('path')[i])};
    })).toEqual({paths:0,announcements:0,same:true});
    expect(await page.evaluate(async()=>{
      let changes=0;const summary=document.querySelector('.fm-outcome-values');
      const observer=new MutationObserver(records=>changes+=records.length);observer.observe(summary,{childList:true});
      timeline.update(4,{announce:true});await Promise.resolve();observer.disconnect();return changes;
    })).toBe(1);
    await page.evaluate(()=>timeline.update(4,{announce:true}));expect(await page.locator('.fm-outcome-values').textContent()).toContain('Unavailable');
    await page.getByRole('combobox',{name:'Recorded outcome metric'}).selectOption('meanRent');expect(await page.locator('.fm-outcome-values').textContent()).toContain('999.123456789 USD/month');expect(await page.locator('.fm-outcome-note').textContent()).toContain('not incumbent');

    expect(await page.locator('svg line[data-zero-axis]').getAttribute('y1')).toBe('20');
    await page.getByRole('combobox',{name:'Recorded outcome metric'}).selectOption('capitalSpending');expect(await page.locator('.fm-outcome-note').textContent()).toContain('cost');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:'/tmp/future-machine-outcome-timeline-320.png',fullPage:true});
    await page.getByText('Exact recorded values and month selection',{exact:true}).click();await page.getByRole('button',{name:'Select recorded month 16',exact:true}).click();expect(await page.evaluate(()=>months.at(-1))).toBe(16);
    await page.evaluate(()=>{timeline.dispose();timeline.dispose();timeline.update(120);});expect(await page.locator('.fm-outcome-timeline').count()).toBe(0);
  }finally{await browser?.close();}
},20000);
