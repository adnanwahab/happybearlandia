import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
test('normal recipe deck keyboard moves preserve state, edits and scenario isolation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/decision.html');
 await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 const group=page.locator('[data-control-group="policy"]');
 const ids=()=>group.locator('[data-parameter-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.parameterId));
 const original=await ids();
 const before=await page.evaluate(()=>structuredClone(window.hblDecisionStudio.state.scenarios));
 const card=group.locator('[data-parameter-id]').first();
 await card.getByRole('button',{name:/down$/}).press('Enter');
 expect(await ids()).toEqual([original[1],original[0],...original.slice(2)]);
 await group.getByRole('button',{name:'Undo card move',exact:true}).press('Enter'); expect(await ids()).toEqual(original);
 await group.getByRole('button',{name:'Redo card move',exact:true}).press('Enter');
 expect(await page.evaluate(()=>window.hblDecisionStudio.state.scenarios)).toEqual(before);
 const selected=await page.locator('#scenario-tabs [aria-selected="true"]').getAttribute('data-scenario-id');
 await page.locator('#scenario-tabs [aria-selected="false"]').first().click();
 await expect(group.getByRole('button',{name:'Undo card move',exact:true})).toBeDisabled();
 await page.locator('#scenario-tabs').locator(`[data-scenario-id="${selected}"]`).click();
 expect(await ids()).toEqual([original[1],original[0],...original.slice(2)]);
 await page.locator('#parameter-permitting_months').fill('12'); await page.locator('#parameter-permitting_months').dispatchEvent('input');
 await group.getByRole('button',{name:'Undo card move',exact:true}).click();
 await expect(page.locator('#parameter-permitting_months')).toHaveValue('12');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-564-after-decision-desktop.png'});
 await page.setViewportSize({width:390,height:844});await group.scrollIntoViewIfNeeded();
 await group.locator('[data-parameter-id]').first().getByRole('button',{name:/down$/}).click();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-564-after-decision-mobile.png'});
});
test('before decision surface evidence from baseline source',async({page})=>{
 for(const path of ['world/decision.html','world/decision/studio.js','world/decision/studio.css']){
  const body=execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'});
  await page.route(`**/${path}`,route=>route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'}));
 }
 await page.goto('/world/decision.html');await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 await page.locator('#parameter-controls').scrollIntoViewIfNeeded();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-564-before-decision-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#parameter-controls').scrollIntoViewIfNeeded();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-564-before-decision-mobile.png'});
});
