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
