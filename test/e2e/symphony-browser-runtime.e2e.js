import {test,expect} from '@playwright/test';

test('normal entry point and keyboard navigation remain usable',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().resourceType()==='document'&&route.request().frame().parentFrame()?route.abort():route.continue());
 const response=await page.goto('/',{waitUntil:'domcontentloaded'});
 expect(response.status()).toBe(200);
 await expect(page.locator('h1').first()).toBeVisible();
 await expect(page.locator('a.flagship-demo')).toBeVisible();
 await page.locator('a.flagship-demo').focus();
 await expect(page.locator('a.flagship-demo')).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/\/world\/future-machine\.html/);
 await expect(page.locator('.fm-ui h1')).toBeVisible();
 await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
 expect(errors).toEqual([]);
 await info.attach('browser-acceptance',{body:JSON.stringify({project:info.project.name,viewport:page.viewportSize(),url:page.url(),errors}),contentType:'application/json'});
});

test('native transition cancellation is observed before document reveal', async ({page}, info) => {
 const errors=[];
 page.on('pageerror', error=>errors.push(error.message));
 await page.addInitScript(() => {
  const registrations=[];
  const original=window.addEventListener;
  window.addEventListener=function(type, listener, options) {
   if(type==='pageswap'||type==='pagereveal') registrations.push({type,state:document.readyState,body:!!document.body});
   return original.call(this,type,listener,options);
  };
  window.__nativePortalRegistrations=registrations;
 });
 await page.route('**/*',route=>route.request().resourceType()==='document'&&route.request().frame().parentFrame()?route.abort():route.continue());
 // Delay the lifecycle script at the real network boundary. A deferred script
 // can lose the first pagereveal; the parser-blocking bootstrap cannot.
 await page.route('**/world/universe/portal.js',async route=>{
  await new Promise(resolve=>setTimeout(resolve,150));
  await route.continue();
 });
 await page.goto('/');
 const registrations=await page.evaluate(()=>window.__nativePortalRegistrations);
 expect(registrations.filter(item=>item.type==='pagereveal')).toEqual([{type:'pagereveal',state:'loading',body:false}]);
 expect(registrations.filter(item=>item.type==='pageswap')).toEqual([{type:'pageswap',state:'loading',body:false}]);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('a.flagship-demo').focus();
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/\/world\/future-machine\.html/);
 await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
 await expect(page.locator('html')).toHaveClass(/portal-reduced/);
 expect(await page.evaluate(()=>window.__nativePortalRegistrations.filter(item=>item.type==='pagereveal'))).toEqual([{type:'pagereveal',state:'loading',body:false}]);
 await page.goBack();
 await expect(page.locator('a.flagship-demo')).toBeVisible();
 expect(errors).toEqual([]);
 await info.attach('native-cancellation',{body:JSON.stringify({registrations,errors}),contentType:'application/json'});
});
