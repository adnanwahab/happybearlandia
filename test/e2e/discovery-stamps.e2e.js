import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const evidence='.mini-symphony-evidence';
test('all authored stamps support keyboard, reload and reset through normal routes',async({page})=>{
  await page.goto('/routes');
  await expect(page.getByText('A quiet petal: not yet discovered.',{exact:true})).toBeVisible();
  for(const [route,name] of [['/tools/flower','A quiet petal'],['/tools/quote-carousel','Between the lines']]){
    await page.goto(route);
    const summary=page.locator('.discovery-stamps summary');await summary.focus();await page.keyboard.press('Enter');
    const button=page.getByRole('button',{name:`Collect ${name}`});
    await button.focus();await page.keyboard.press('Space');
    await expect(page.getByRole('button',{name:'Stamp collected'})).toBeDisabled();
  }
  await page.goto('/routes');await expect(page.locator('.discovery-stamps')).not.toContainText('not yet discovered');
  await page.reload();await expect(page.locator('.discovery-stamps')).toContainText('Between the lines: discovered');
  await page.getByRole('button',{name:'Reset stamp progress'}).click();
  await page.reload();await expect(page.locator('.discovery-stamps')).toContainText('Between the lines: not yet discovered');
});
test('touch, reduced motion, unavailable storage and responsive evidence',async({browser})=>{
  mkdirSync(evidence,{recursive:true});
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,reducedMotion:'reduce'});
    await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}})});
    const page=await context.newPage();
    await page.goto('/tools/flower');await page.locator('.discovery-stamps summary').tap();
    await page.getByRole('button',{name:'Collect A quiet petal'}).tap();
    await expect(page.locator('.discovery-stamps [role=status]')).toContainText('Storage unavailable');
    await expect(page.locator('.discovery-stamps')).toContainText('A quiet petal: discovered');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`${evidence}/SHE-574-after-flower-${width}.png`});
    await page.goto('/routes');await expect(page.locator('.discovery-stamps')).toContainText('not yet discovered');
    await page.screenshot({path:`${evidence}/SHE-574-after-routes-${width}.png`,fullPage:false});
    await context.close();
  }
});
test('malformed or missing progress does not prevent collecting',async({page})=>{
 await page.goto('/routes');await page.evaluate(()=>localStorage.setItem('hbl-discovery-stamps-v1','{invalid'));
 await page.reload();await expect(page.locator('.discovery-stamps')).toContainText('not yet discovered');
 await page.goto('/tools/quote-carousel');await page.locator('.discovery-stamps summary').click();
 await page.getByRole('button',{name:'Collect Between the lines'}).click();
 await expect(page.getByRole('button',{name:'Stamp collected'})).toBeDisabled();
});
