import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('world/render/inspection-freeze.js','utf8');
test('mobile keyboard, reduced motion, model pause, failures and route cleanup',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://freeze.test/**',route=>route.fulfill({contentType:'text/html',body:'<main></main>'}));await page.goto('https://freeze.test/');
 await page.evaluate(async source=>{const m=await import('data:text/javascript;base64,'+btoa(source));window.supported=true;window.fail=false;window.paused=false;window.gate=m.createInspectionFreeze({supported:()=>supported,capture:()=>{if(fail)throw Error();return ['source-id-9'];}});window.ui=m.mountInspectionFreeze({container:document.querySelector('main'),gate,modelPaused:()=>paused});},source);
 const button=page.getByRole('button');await button.focus();await expect(button).toBeFocused();await page.keyboard.press('Enter');await expect(button).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('status')).toContainText('Model running');
 await page.evaluate(()=>{paused=true;ui.update();});await expect(page.getByRole('status')).toContainText('Model paused');
 await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate')));await expect(button).toHaveAttribute('aria-pressed','false');
 await page.evaluate(()=>supported=false);await button.tap();await expect(page.getByRole('status')).toContainText('Unavailable');
 await page.evaluate(()=>{supported=true;fail=true;});await button.click();await expect(page.getByRole('status')).toContainText('Could not freeze');
 await page.evaluate(()=>ui.destroy());await expect(button).toHaveCount(0);
});
