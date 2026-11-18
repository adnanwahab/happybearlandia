import {test,expect} from '@playwright/test';
// Coordinator acceptance harness: intentionally asserts production mounts, never injects them.
test('saved presentation exposes QR and exact reproduction appendix',async({page,context},info)=>{
 test.skip(!process.env.HBL_SHARING_SAVED_URL,'Requires coordinator-mounted saved presentation URL');
 await page.goto(process.env.HBL_SHARING_SAVED_URL);
 const qr=page.getByRole('img',{name:'QR code for the saved read-only experiment'});
 await expect(qr).toBeVisible();
 const link=page.getByRole('link',{name:'Open saved read-only experiment'});
 const href=await link.getAttribute('href');const url=new URL(href);
 expect(url.searchParams.get('readonly')).toBe('1');expect(url.searchParams.get('experiment')).toBeTruthy();expect(url.username).toBe('');expect(url.password).toBe('');
 await page.screenshot({path:info.outputPath('presentation-sharing.png'),fullPage:true});
 const recipient=await context.newPage();await recipient.goto(href);
 await expect.poll(()=>recipient.evaluate(()=>window.hblDecisionStudio?.state?.readonly)).toBe(true);
 const opening=context.waitForEvent('page');await page.locator('#decision-trust [data-action="brief"]').click();const brief=await opening;
 await expect(brief.getByRole('region',{name:'Reproduction appendix'})).toBeVisible();
 await brief.screenshot({path:info.outputPath('reproduction-appendix.png'),fullPage:true});
 await recipient.close();await brief.close();
});
