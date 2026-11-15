import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`City Whispers ${mobile?'mobile':'desktop'} grounded navigation`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/city-speaks/');
 await expect(page.getByRole('heading',{name:'City Whispers',exact:true})).toBeVisible();
 const nav=page.getByRole('navigation',{name:'Neighborhoods'});
 await nav.getByRole('button',{name:'Center',exact:true}).focus();await page.keyboard.press('Enter');
 const timeline=page.getByRole('slider',{name:'Recorded month'});
 for(let i=0;i<24;i++){await timeline.fill(String(i%12));await nav.getByRole('button').nth(i%3).click();}
 await timeline.fill('0');await nav.getByRole('button',{name:'Center',exact:true}).click();
 const bubbles=page.getByRole('region',{name:'Event bubbles'});
 await expect(bubbles).toContainText('No supported, unambiguous event records');
 await nav.getByRole('button',{name:'Riverside',exact:true}).click();
 await expect(bubbles.locator('article').first()).toContainText('[Event ');
 {
  await bubbles.getByRole('button',{name:'WHY',exact:true}).first().focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('region',{name:'Event evidence'})).toBeFocused();
  await expect(page.getByRole('region',{name:'Event evidence'})).toContainText('"id"');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.mini-symphony-evidence/SHE-518-whispers-after-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 const report=await page.evaluate(async()=>{const {mountWhispers}=await import('/world/city-speaks/whispers.js');const host=document.createElement('div');document.body.append(host);const v=mountWhispers(host,[]);v.destroy();v.destroy();return host.childElementCount;});expect(report).toBe(0);
 await page.goto('/world/city-lab.html');await page.goBack();await expect(page.getByRole('heading',{name:'City Whispers',exact:true})).toBeVisible();
});
