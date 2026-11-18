import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// Listener-free component fallback: actual World HTML and hunt assets; unrelated
// World modules are suppressed. Full native integration uses the server config.
test.beforeEach(async({page,baseURL})=>{
  if(baseURL!=='https://hunt.test')return;
  await page.route('https://hunt.test/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/world/'||path==='/world')return route.fulfill({contentType:'text/html',body:readFileSync('world/index.html','utf8')});
    if(/^\/world\/evidence-hunt\/(main|panel|core)\.js$/.test(path))return route.fulfill({contentType:'text/javascript',body:readFileSync('.'+path,'utf8')});
    if(path==='/world/evidence-hunt/demo.json')return route.fulfill({contentType:'application/json',body:readFileSync('.'+path,'utf8')});
    return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':'text/plain',body:''});
  });
});
for(const mobile of [false,true])test(`normal World entry, inspector navigation and reload ${mobile?'mobile':'desktop'}`,async({page})=>{
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/world/?demo=1&synthetic=1&people=16');
  const hunt=page.getByTestId('neighborhood-hunt');
  await hunt.locator('summary').focus();await hunt.locator('summary').press('Enter');await hunt.getByRole('button',{name:'Open pinned demo'}).click();
  await expect(hunt.getByRole('status')).toContainText('0/5');
  await expect(hunt.getByRole('button',{name:'Inspect transit',exact:true})).toBeDisabled();
  for(const id of ['housing','transit','flood','business','households']){
    await hunt.getByRole('button',{name:'Inspect '+id,exact:true}).click();
    await expect(hunt.getByRole('region',{name:'Mechanism inspector'})).toBeVisible();
    await expect(hunt.locator('pre')).not.toBeEmpty();
  }
  await expect(hunt.getByRole('status')).toContainText('Hunt complete');
  await page.reload();await hunt.locator('summary').click();
  await hunt.getByRole('button',{name:'Open pinned demo'}).click();
  await expect(hunt.getByRole('status')).toContainText('5/5');
  await hunt.getByRole('button',{name:'Cancel hunt'}).click();
  await hunt.locator('summary').click();await expect(hunt.getByRole('status')).toContainText('cancelled');
  await hunt.getByRole('button',{name:'Open pinned demo'}).click();
  await expect(hunt.getByRole('status')).toContainText('5/5');
  await hunt.getByRole('button',{name:'Reset local progress'}).click();
  await expect(hunt.getByRole('status')).toContainText('0/5');
});
test('unavailable, mismatched and cancelled loads do not award clues',async({page})=>{
  let mode='missing';let pending;
  await page.route('**/world/evidence-hunt/demo.json',async route=>{
    if(mode==='missing')return route.fulfill({status:404,body:'unavailable'});
    if(mode==='mismatch')return route.fulfill({status:200,body:'{"seed":715}'});
    await new Promise(resolve=>{pending=resolve;});
    await route.fulfill({status:404,body:'late'}).catch(()=>{});
  });
  await page.goto('/world/?demo=1&synthetic=1&people=16');
  const hunt=page.getByTestId('neighborhood-hunt');await hunt.locator('summary').click();
  await hunt.getByRole('button',{name:'Open pinned demo'}).click();
  await expect(hunt.getByRole('status')).toContainText('No source data');
  mode='mismatch';await hunt.getByRole('button',{name:'Open pinned demo'}).click();
  await expect(hunt.getByRole('status')).toContainText('Replay mismatch');
  mode='pending';await hunt.getByRole('button',{name:'Open pinned demo'}).click();
  await expect(hunt.getByRole('status')).toContainText('Loading');
  await hunt.getByRole('button',{name:'Cancel hunt'}).click();pending?.();
  await hunt.locator('summary').click();await expect(hunt.getByRole('status')).toContainText('cancelled');
  await expect(hunt.locator('ol li')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('hbl.neighborhood-hunt.v1'))).toBeNull();
});
