import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

// Lifecycle fixtures require the dedicated config's disposable SQLite store.
// Never run them against the ordinary development server/store.
test.skip(!process.env.HBL_REPLAY_AUDIT_STORE,'Run with --config test/scenario-replay.browser.config.js');

async function state(page){
 return page.evaluate(()=>{
  const h=window.hblRealityCompiler,s=h.studio.getState();
  return {manifest:s.result.manifest,selected:s.selected,initial:h.initial};
 });
}
async function scrub(page,month){
 const slider=page.getByRole('slider',{name:'Recorded world time'});
 await expect(slider).toBeEnabled();await slider.fill(String(month));await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.hblRealityCompiler?.studio.getState().selected?.treatment.state.month)).toBe(month);
 await expect(page.locator('[data-r-time-label]')).toContainText(`${month} modeled months`);
 return state(page);
}

// Deliberate persisted-record fixtures, not intercepted model/API responses.
function lifecycleRecord(record,kind){
 const id={expired:'Expired00001',incompatible:'Obsolete0001',tampered:'Tampered0001'}[kind];
 execFileSync('bun',['-e',`
  import {Database} from 'bun:sqlite';
  const [path,raw,kind,id]=process.argv.slice(1),record=JSON.parse(raw);
  record.id=id;record.url='/r/'+id;
  if(kind==='expired')record.expiresAt=new Date(Date.now()-1).toISOString();
  if(kind==='incompatible')record.result.manifest.modelVersion='unsupported-audit-version';
  if(kind==='tampered')record.result.runs[0].baseline.metrics.population+=1;
  const db=new Database(path);
  db.query('INSERT INTO reality_shares(id,created_at,expires_at,data) VALUES(?,?,?,?)')
   .run(id,Date.parse(record.createdAt),Date.parse(record.expiresAt),JSON.stringify(record));
  db.close();
 `,join(process.env.HBL_REPLAY_AUDIT_STORE,'shares.sqlite'),JSON.stringify(record),kind,id]);
 return '/r/'+id;
}

test('create → share → isolated recipient → scrub preserves frozen inputs and rejects unavailable records',async({page,browser,request},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.policy-entry [name="proposal"]').fill('Build affordable homes and speed up permits.');
 await page.locator('.policy-entry button[type="submit"]').click();
 await page.waitForFunction(()=>window.hblRealityCompiler?.studio);
 await page.locator('[data-r-runs]').fill('2');await page.locator('[data-r-horizon]').fill('3');
 await page.locator('[data-r-run]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblRealityCompiler.studio.getState().selected?.engine),{timeout:90000}).toBe('city');
 await page.locator('[data-r-futures] button').nth(1).click();
 await expect.poll(()=>page.evaluate(()=>window.hblRealityCompiler.studio.getState().selected.runIndex)).toBe(1);
 const source=await state(page);
 await page.getByRole('button',{name:'Create experiment link',exact:true}).click();
 const link=page.getByRole('link',{name:'Open shared experiment'});await expect(link).toBeVisible();
 const href=await link.getAttribute('href'),id=new URL(href).pathname.split('/').pop();
 const response=await request.get('/api/reality-shares/'+id);expect(response.status()).toBe(200);
 const record=await response.json();
 expect(record.result.manifest).toEqual(source.manifest);
 expect(record.verification).toBe('client-replay-required');
 const expected={};for(const month of [0,1,3])expected[month]=await scrub(page,month);
 const cases=[['valid',href,null],['missing','/r/Missing00001','Share not found or expired'],
  ['expired',lifecycleRecord(record,'expired'),'Share not found or expired'],
  ['incompatible',lifecycleRecord(record,'incompatible'),'Stored model version is unavailable'],
  ['tampered',lifecycleRecord(record,'tampered'),'did not reproduce']];
 for(const [kind,url,message] of cases){
  const context=await browser.newContext(),recipient=await context.newPage();
  recipient.on('pageerror',e=>errors.push(e.message));
  try{
   expect(await context.cookies()).toEqual([]);
   await recipient.goto(url);
   if(message){
    await expect(recipient.locator('#reality-status')).toContainText(message);
    expect(await recipient.evaluate(()=>window.hblRealityCompiler?.studio.getState().selected??null)).toBeNull();
    const slider=recipient.getByRole('slider',{name:'Recorded world time'});
    if(await slider.count())await expect(slider).toBeDisabled();
    await expect(recipient.locator('#reality-status')).not.toContainText('Shared future reproduced');
   }else{
    await expect(recipient.locator('#reality-status')).toContainText('Shared future reproduced',{timeout:90000});
    expect(await state(recipient)).toEqual(source);
    await expect(recipient.getByTestId('reality-studio')).toContainText('synthetic conditional futures');
    for(const month of [0,1,3,0,3])expect(await scrub(recipient,month)).toEqual(expected[month]);
   }
   await info.attach(kind,{body:JSON.stringify({url,status:await recipient.locator('#reality-status').innerText()}),contentType:'application/json'});
  }finally{await context.close();}
 }
 // Scrubbing and failed opens cannot rewrite the original frozen record.
 expect(await (await request.get('/api/reality-shares/'+id)).json()).toEqual(record);
 expect(errors).toEqual([]);
});
