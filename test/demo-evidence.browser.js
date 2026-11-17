// node test/demo-evidence.browser.js — browser integration without a listening server.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.route('http://evidence.local/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const files = ['/world/demo-evidence.html','/world/metrics/demo-evidence-view.js','/world/metrics/demo-evidence.js','/world/metrics/agent-counts.js'];
    if (!files.includes(path)) return route.abort();
    await route.fulfill({body:await readFile('.'+path),contentType:path.endsWith('.js')?'text/javascript':'text/html'});
  });
  await page.goto('http://evidence.local/world/demo-evidence.html');
  assert.match(await page.locator('[role=status]').innerText(), /No receipt loaded/);
  const { runFixture } = await import('../world/metrics/agent-counts.js');
  const receipt = {schemaVersion:'resident-demo-receipt.v1',run:runFixture(),wallSeconds:2,measuredAt:'2026-11-12T00:00:00Z',machine:{cpu:'test',platform:'test',arch:'test',runtime:'test'},command:'test'};
  await page.locator('input').setInputFiles({name:'receipt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(receipt))});
  await page.getByText('Receipt replay matched.',{exact:false}).waitFor();
  assert.match(await page.locator('[data-summary]').innerText(), /128 explicit synthetic/);
  const download = page.waitForEvent('download');
  await page.getByRole('button').click();
  assert.equal((await download).suggestedFilename(),'resident-demo-evidence.json');
  await page.locator('input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await page.getByText('Evidence unavailable:',{exact:false}).waitFor();
  assert.equal(await page.locator('section').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS: empty/upload/replay/download/invalid receipt/mobile width');
} finally { await browser.close(); }
