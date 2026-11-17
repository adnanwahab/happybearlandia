import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const base='http://127.0.0.1:3394', path='/world/future-machine/share/import.html';
try {
  await page.goto(base+path);
  await page.getByRole('heading',{name:'Import a run receipt',exact:true}).waitFor();
  const receipt=await page.evaluate(async()=>{
    const {createExperiment}=await import('/world/future-machine/data/index.js');
    const {DEFAULT_RECIPE}=await import('/world/future-machine/contracts.js');
    const {createRunReceipt,canonicalReceiptJSON}=await import('/world/future-machine/share/run-receipt.js');
    return canonicalReceiptJSON(await createRunReceipt(await createExperiment({...DEFAULT_RECIPE,households:2,seed:0}),{month:16}));
  });
  const verify=()=>page.getByRole('button',{name:'Verify and replay receipt'}).click();
  await page.getByLabel('Receipt JSON',{exact:true}).fill(receipt);await verify();
  await page.getByText('Receipt and saved replay verified.',{exact:true}).waitFor();
  const href=await page.getByRole('link',{name:'Open verified comparison'}).getAttribute('href');
  assert.equal(new URL(href).searchParams.get('month'),'16');assert.match(new URL(href).searchParams.get('experiment'),/^city_/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/private/tmp/hbl-she84-import-mobile.png',fullPage:true});
  await page.getByLabel('Receipt JSON',{exact:true}).fill('{');
  assert.equal(await page.getByRole('link',{name:'Open verified comparison'}).count(),0);
  await verify();await page.getByRole('alert').filter({hasText:'not valid JSON'}).waitFor();
  await page.getByLabel('Or choose a JSON file',{exact:false}).setInputFiles({name:'receipt.json',mimeType:'application/json',buffer:Buffer.from(receipt)});
  await verify();await page.getByText('Receipt and saved replay verified.',{exact:true}).waitFor();
  await page.getByLabel('Or choose a JSON file',{exact:false}).setInputFiles({name:'too-large.json',mimeType:'application/json',buffer:Buffer.alloc(4_500_001,32)});
  await verify();await page.getByRole('alert').filter({hasText:'4.5 MB'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Open verified comparison'}).count(),0);
  await page.goto(href+'&renderer=canvas');
  await page.getByRole('link',{name:'Import run receipt',exact:true}).waitFor();
  await page.getByRole('link',{name:'Import run receipt',exact:true}).click();
  await page.getByRole('heading',{name:'Import a run receipt',exact:true}).waitFor();
  console.log(JSON.stringify({passed:true,realCityReplay:true,paste:true,upload:true,malformed:true,oversized:true,staleSuccessCleared:true,mobileWidth:390,normalEntryLink:true,selectedMonth:16}));
} finally {await browser.close();}
