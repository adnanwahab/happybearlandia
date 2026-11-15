// Socket-free static-page smoke. Uses repository assets; does not exercise Bun routing.
const { chromium } = require(process.env.HBL_PLAYWRIGHT_PATH || 'playwright');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve, extname } = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({reducedMotion:'reduce'});
  const root = resolve(__dirname,'..');
  const evidence = resolve(root,'.mini-symphony-evidence'); mkdirSync(evidence,{recursive:true});
  const page = await context.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  let baseline = true;
  await context.route('http://square.local/**', async route => {
    let path = new URL(route.request().url()).pathname;
    if (path.endsWith('/')) path += 'index.html';
    const type = {'.js':'application/javascript','.html':'text/html','.css':'text/css'}[extname(path)] || 'text/plain';
    try {
      const body = baseline && path==='/world/civilization/index.html'
        ? execFileSync('git',['show','HEAD:world/civilization/index.html'],{cwd:root})
        : readFileSync(resolve(root,'.'+path));
      await route.fulfill({body,contentType:type});
    } catch { await route.fulfill({status:404,body:'Missing'}); }
  });
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const size = viewport.width===390?'mobile':'desktop'; await page.setViewportSize(viewport);
    await page.goto('http://square.local/world/civilization/');
    await page.screenshot({path:resolve(evidence,`SHE-523-square-before-${size}.png`),fullPage:true});
  }
  baseline=false;
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const size = viewport.width===390?'mobile':'desktop'; await page.setViewportSize(viewport);
    await page.goto('http://square.local/world/civilization/');
    await page.getByRole('link',{name:'Public Square',exact:true}).click();
    await page.getByRole('status').filter({hasText:'No recorded gatherings'}).waitFor();
    assert.equal(await page.locator('.figure').count(),0);
    await page.getByLabel('Presentation',{exact:true}).focus();
    await page.getByLabel('Presentation',{exact:true}).press('ArrowDown');
    await page.getByLabel('Presentation',{exact:true}).press('Enter');
    await page.getByLabel('Your fictional community day').fill('Community garden day');
    await page.getByRole('heading',{name:'Community garden day',exact:true}).waitFor();
    assert.equal(await page.locator('.figure').count(),48);
    for(let i=0;i<30;i++) await page.getByLabel('View',{exact:true}).selectOption(i%2?'wide':'stage');
    assert.equal(await page.locator('.figure').count(),48);
    await page.screenshot({path:resolve(evidence,`SHE-523-square-after-${size}.png`),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByLabel('Show decorative figures').uncheck(); assert.equal(await page.locator('.figure').count(),0);
    await page.getByLabel('Presentation',{exact:true}).selectOption('recorded');
    const event = {id:'fixture-event',type:'block-party',districtId:'fixture-square',source:'manual',synthetic:true,startMinute:10,endMinute:20};
    const snapshot={schemaVersion:'culture.v1',seed:'fixture-523',minute:30,history:[{type:'EVENT_STARTED',minute:10,event}],activeEvents:[]};
    await page.getByLabel('Import culture snapshot',{exact:false}).setInputFiles({name:'snapshot.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))});
    await page.locator('#receipt').filter({hasText:'fixture-event'}).waitFor();
    await page.getByLabel('Show decorative figures').check();
    const slider=page.getByLabel('Inspect simulation minute');
    for(let i=0;i<20;i++){ await slider.press('End'); await slider.press('Home'); }
    assert.equal(await page.locator('.figure').count(),0);
    await slider.fill('10'); assert.equal(await page.locator('.figure').count(),48);
    await slider.fill('20'); assert.equal(await page.locator('.figure').count(),0);
    await page.getByLabel('Import culture snapshot',{exact:false}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.getByRole('status').filter({hasText:'Cannot open snapshot'}).waitFor();
    assert.equal(await page.locator('#receipt').innerText(),'');
    await page.getByLabel('Presentation',{exact:true}).selectOption('fictional');
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
    assert.equal(await page.locator('.figure').count(),0);
    await page.getByLabel('Show decorative figures').uncheck(); await page.getByLabel('Show decorative figures').check();
    assert.equal(await page.locator('.figure').count(),0);
    await page.getByRole('link',{name:'Emergent Civilizations',exact:true}).click();
  }
  assert.deepEqual(errors,[]);
  await browser.close(); console.log('PASS: desktop/mobile hub entry, keyboard, motion preference, import/error, intervals, rapid view/time changes and cleanup; no page errors. Static transport only.');
})().catch(error=>{console.error(error);process.exit(1)});
