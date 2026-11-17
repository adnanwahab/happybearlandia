// Uses an installed Playwright package; no production server or credentials.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HBL_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
try {
 const page=await browser.newPage();
 await page.route('https://microagents.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(!/^\/world\/microagents\/[\w.-]+$/.test(path)) return route.abort();
  const body=await readFile(resolve('.'+path));
  await route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':'text/html'});
 });
 await page.goto('https://microagents.test/world/microagents/index.html');
 await page.click('#run');
 await page.waitForFunction(()=>!document.querySelector('#run').disabled,{},{timeout:180000});
 const report=JSON.parse(await page.locator('#output').innerText());
 await writeFile(process.argv[2] || '/tmp/microagents.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(report.scenarios.some(s=>s.status!=='completed')) process.exitCode=1;
} finally {await browser.close();}
