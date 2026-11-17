import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';

test('normal House entry exposes truthful empty history with keyboard and mobile fallback',async({page})=>{
 await openPairHouse(page);
 const trigger=page.getByRole('button',{name:'Family milestones',exact:true});
 await trigger.focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Family milestones',exact:true});
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('status')).toContainText('No matching recorded milestones');
 await expect(dialog).toContainText('Live autosaves are excluded');
 await expect(dialog.getByRole('link',{name:/Seek exact tick/})).toHaveCount(0);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-559-house-after-desktop.png'});
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
 await page.setViewportSize({width:390,height:844});await trigger.click();
 await expect(dialog).toBeVisible();expect(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-559-house-after-mobile.png'});
});

test('record-backed filters, exact seek and source inspection work without a renderer',async({page})=>{
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{
  const {mountHouseMilestones}=await import('/world/house/milestones-ui.js');
  const {householdMilestones}=await import('/world/house/milestones.js');
  const model={prefix:'fixture',modelVersion:'1.3.0',minute:12,people:{age:[1],household:[0]},events:[
   {schemaVersion:'event.v2',modelVersion:'1.3.0',synthetic:true,id:'job01',type:'JOB_FOUND',personId:'fixture-p0',tick:12,minute:12},
   {schemaVersion:'event.v2',modelVersion:'1.3.0',synthetic:true,id:'move01',type:'HOUSEHOLD_MOVED',householdId:'fixture-h0',tick:4,minute:4}]};
  const rows=householdMilestones([{id:'fixture01',tick:12,stepMinutes:1,model}], 'fixture-h0');
  window.milestones=mountHouseMilestones(document.body,{experimentId:'fixture01',householdId:'fixture-h0',load:async()=>({rows,notice:'Disposable synthetic test fixture'})});
 });
 await page.getByRole('button',{name:'Family milestones',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Family milestones',exact:true});
 await expect(dialog.getByRole('link',{name:'Seek exact tick 12'})).toHaveAttribute('href','/world?experiment=fixture01');
 await expect(dialog).toContainText('Exact snapshot unavailable at tick 4');
 await dialog.getByLabel('Milestone category').selectOption('job');await expect(dialog.getByRole('heading',{name:'Household moved'})).toHaveCount(0);
 await dialog.getByLabel('Exact tick').fill('4');await expect(dialog.getByRole('status')).toContainText('No matching');
 await dialog.getByLabel('Milestone category').selectOption('moving-in');await expect(dialog.getByRole('heading',{name:'Household moved'})).toBeVisible();
 await dialog.getByText('Source record · fixture01').click();await expect(dialog.locator('pre')).toContainText('move01');
 await expect(dialog.getByRole('link',{name:'Open source checkpoint'})).toHaveAttribute('href','/api/world-experiments/fixture01');
});
