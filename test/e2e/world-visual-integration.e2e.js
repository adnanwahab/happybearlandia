import {test,expect} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
const route='/world/?demo=1&synthetic=1&people=80';
const directory='/tmp/hbl-world-visual-pass';
test('integration evidence: actual timings, matched replay, failure recovery and retained entry points',async({page})=>{
  mkdirSync(directory,{recursive:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(route);await page.waitForFunction(()=>window.hblVisualPass?.ready);
  await page.getByTestId('quick-demo').click();
  await page.waitForFunction(()=>window.hblVisualPass.getState().status==='completed');
  const first=await page.evaluate(()=>({startup:window.hblWorldStartup,state:window.hblVisualPass.getState(),renderer:window.hblCityRenderer?.getPerformanceStats?.(),agent:navigator.userAgent}));
  await page.screenshot({path:directory+'/desktop-comparison.png'});
  await page.getByTestId('quick-demo-noPlan').click();
  await expect(page.getByTestId('quick-demo-noPlan')).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('quick-demo-withPlan').click();
  await page.getByTestId('quick-demo-inspect').click();await expect(page.locator('#inspect')).toBeVisible();
  await page.screenshot({path:directory+'/desktop-inspector.png'});await page.keyboard.press('Escape');
  await page.evaluate(()=>window.hblVisualPass.controller.replay());
  const replay=await page.evaluate(()=>window.hblVisualPass.getState());
  expect(replay.result.scores).toEqual(first.state.result.scores);
  // Fail the actual module-worker network request, then recover with a new worker.
  await page.route('**/world/cycle.worker.js',route=>route.abort());
  await page.evaluate(()=>window.hblVisualPass.controller.replay());
  expect(await page.evaluate(()=>window.hblVisualPass.getState().status)).toBe('error');
  expect(await page.evaluate(()=>window.hblVisualPass.getState().feedback)).toBe(null);
  await page.unroute('**/world/cycle.worker.js');
  await page.evaluate(()=>window.hblVisualPass.controller.replay());
  expect(await page.evaluate(()=>window.hblVisualPass.getState().status)).toBe('completed');
  await page.evaluate(()=>window.hblVisualPass.panels.closeAll());
  await page.locator('#top > summary').click();
  await page.locator('#demoBtn').click();await expect(page.locator('#demoBar')).toBeVisible();
  await page.locator('#demoStop').click();
  await expect(page.locator('#runExperimentBtn')).toBeEnabled();
  expect(errors.filter(message=>!message.includes('Failed to fetch'))).toEqual([]);
  writeFileSync(directory+'/desktop-measurements.json',JSON.stringify({...first,replayScoresIdentical:true,errorRecovery:true,errors},null,2));
});
test('WebGL2 and reduced motion, mobile screenshots and one active panel',async({page})=>{
  mkdirSync(directory,{recursive:true});await page.emulateMedia({reducedMotion:'reduce'});
  for(const [name,width,height] of [['narrow',320,640],['phone',390,844],['tablet',768,1024],['landscape',844,390]]){
    await page.setViewportSize({width,height});await page.goto(route+'&renderer=webgl');await page.waitForFunction(()=>window.hblVisualPass?.ready);
    await page.getByTestId('quick-demo').click();await page.waitForFunction(()=>window.hblVisualPass.getState().status==='completed');
    const state=await page.evaluate(()=>({state:window.hblVisualPass.getState(),startup:window.hblWorldStartup,overflow:document.documentElement.scrollWidth>innerWidth,panels:[...document.querySelectorAll('[data-world-panel]')].filter(node=>node.getClientRects().length&&!node.hidden).map(node=>node.getAttribute('data-world-panel'))}));
    expect(state.overflow).toBe(false);expect(state.panels).toEqual(['guide']);
    await page.screenshot({path:directory+'/'+name+'-comparison.png'});
    await page.getByTestId('quick-demo-inspect').click();await expect(page.locator('#inspect')).toBeVisible();
    await page.screenshot({path:directory+'/'+name+'-inspector.png'});
    writeFileSync(directory+'/'+name+'-measurements.json',JSON.stringify(state,null,2));
  }
});
test('missing graphics exposes a usable failure state',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
  await page.goto(route+'&renderer=webgl');
  await expect(page.locator('#loading')).toHaveAttribute('role','alert');
  await expect(page.locator('#loading')).toContainText('3D World could not start');
  await expect(page.locator('#loading').getByRole('button',{name:'Try again'})).toBeVisible();
  await expect(page.locator('#loading').getByRole('link',{name:'Return home'})).toHaveAttribute('href','/');
});
test('touch opens, dismisses and reopens a single guide',async({browser,baseURL})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await page.goto(baseURL+route+'&renderer=webgl');await page.waitForFunction(()=>window.hblVisualPass?.ready);
  await page.getByRole('button',{name:'Close panel',exact:true}).tap();
  await expect(page.locator('#firstRunGuide')).toBeHidden();
  await page.locator('#world-guide-button').tap();await expect(page.getByTestId('quick-demo')).toBeVisible();
  expect(await page.evaluate(()=>document.activeElement===document.getElementById('firstRunGuide'))).toBe(true);
  await page.getByTestId('quick-demo').tap();await page.waitForFunction(()=>window.hblVisualPass.getState().observation!=null);
  await page.getByTestId('quick-demo-stop').tap();
  expect(await page.evaluate(()=>window.hblVisualPass.getState().status)).toBe('stopped');
  await context.close();
});
test('full civic tour completes using real workers when remote synthesis is unavailable',async({page})=>{
  test.setTimeout(180000);await page.route('**/api/plan',route=>route.abort());
  await page.goto(route+'&renderer=webgl');await page.waitForFunction(()=>window.hblVisualPass?.ready);
  await page.getByText('More city actions',{exact:true}).click();await page.getByRole('button',{name:'Full civic tour',exact:true}).click();
  await page.evaluate(()=>{window.tourAdvance=setInterval(()=>document.getElementById('demoSkip')?.click(),100);});
  await expect(page.locator('#demoStep')).toHaveText('Recap',{timeout:150000});
  await expect(page.locator('#demoCaption')).toContainText('Cycle 1:');
  await page.evaluate(()=>clearInterval(window.tourAdvance));await page.locator('#demoStop').click();
});
test('representative pinned population records actual pacing',async({page})=>{
  test.setTimeout(180000);await page.goto('/world/?demo=1&synthetic=1&people=500&renderer=webgl');await page.waitForFunction(()=>window.hblVisualPass?.ready);
  await page.getByTestId('quick-demo').click();await page.waitForFunction(()=>['completed','error'].includes(window.hblVisualPass.getState().status),null,{timeout:150000});
  const record=await page.evaluate(()=>({state:window.hblVisualPass.getState(),startup:window.hblWorldStartup}));
  expect(record.state.status).toBe('completed');mkdirSync(directory,{recursive:true});writeFileSync(directory+'/population-500-measurements.json',JSON.stringify(record,null,2));
});
