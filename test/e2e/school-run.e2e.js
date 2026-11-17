import {test,expect} from '@playwright/test';
test('normal challenge navigation and keyboard route choice produce recorded success, failure and replay',async({page})=>{
 await page.goto('/world/challenges.html');
 await page.getByRole('link',{name:'Play School-Run Rush Hour'}).click();
 const panel=page.getByRole('region',{name:'School-Run Rush Hour'});
 await expect(panel).toBeVisible();await expect(panel).toContainText('No measured traffic observations');
 await panel.getByRole('button',{name:'Run school morning'}).click();await expect(panel.getByRole('status')).toContainText('Try another route');
 const route=panel.getByRole('combobox');await route.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await panel.getByRole('button',{name:'Run school morning'}).click();await expect(panel.getByRole('status')).toContainText('Morning solved');
 await expect(panel.getByRole('status')).toContainText('280 → 120');await expect(panel.locator('li')).toHaveCount(8);
 await panel.getByRole('button',{name:'Verify recorded replay'}).click();await expect(panel.getByRole('status')).toContainText('replay verified');
 await page.setViewportSize({width:390,height:844});await expect(route).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('missing source, cancellation and replay mismatch remain explicit with no stale results',async({page})=>{
 await page.goto('/world/challenges.html');
 await page.evaluate(async()=>{const {mountSchoolRun}=await import('/world/school-run/ui.js');const root=document.querySelector('#school-run');window.schoolPanel=mountSchoolRun(root,{loadSource:async()=>null});});
 const panel=page.getByRole('region',{name:'School-Run Rush Hour'});
 await panel.getByRole('button',{name:'Run school morning'}).click();await expect(panel.getByRole('status')).toContainText('No source');await expect(panel.locator('li')).toHaveCount(0);
 await page.evaluate(async()=>{window.schoolPanel.destroy();const {mountSchoolRun}=await import('/world/school-run/ui.js');window.schoolPanel=mountSchoolRun(document.querySelector('#school-run'),{loadSource:()=>new Promise(resolve=>window.finishSchoolLoad=resolve)});});
 await panel.getByRole('button',{name:'Run school morning'}).click();await panel.getByRole('button',{name:'Cancel school run'}).click();
 await page.evaluate(async()=>{const {DEMO}=await import('/world/school-run/model.js');window.finishSchoolLoad(DEMO);});
 await expect(panel.getByRole('status')).toHaveText('Cancelled; no score.');await expect(panel.locator('li')).toHaveCount(0);
 await page.evaluate(async()=>{window.schoolPanel.destroy();const {mountSchoolRun}=await import('/world/school-run/ui.js');const {DEMO}=await import('/world/school-run/model.js');mountSchoolRun(document.querySelector('#school-run'),{loadSource:async()=>({...DEMO,seed:1})});});
 await panel.getByRole('button',{name:'Run school morning'}).click();await expect(panel.getByRole('status')).toContainText('Replay mismatch');await expect(panel.getByRole('button',{name:'Verify recorded replay'})).toBeDisabled();
});
