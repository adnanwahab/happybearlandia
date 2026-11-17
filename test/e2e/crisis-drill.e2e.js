import {test,expect} from '@playwright/test';

test('normal challenge navigation, decision, independent alternative and seed replay',async({page})=>{
 await page.goto('/world/challenges.html');
 await page.getByRole('link',{name:'Try the Crisis Judgment Drill'}).focus();await page.keyboard.press('Enter');
 const panel=page.getByRole('region',{name:'Crisis Judgment Drill'});
 await expect(page).toHaveURL(/#crisis-drill$/);await expect(panel.getByRole('button',{name:'Commit decision and inspect'})).toBeDisabled();
 await panel.getByRole('button',{name:'Load pinned demo'}).click();await expect(panel.getByRole('status')).toContainText('Objectives frozen');
 await panel.getByRole('button',{name:'Commit decision and inspect'}).click();await expect(panel.getByRole('heading',{name:'Decision: Reserve funds'})).toBeVisible();
 await expect(panel.getByRole('cell',{name:'objectives-met',exact:true})).toHaveCount(2);await expect(panel.getByRole('cell',{name:'objectives-not-met',exact:true})).toHaveCount(1);
 await panel.getByRole('radio',{name:'Prepare drainage'}).check();await panel.getByRole('button',{name:'Review alternative'}).click();await expect(panel.getByRole('heading',{name:'Alternative review: Prepare drainage'})).toBeVisible();
 await expect(panel.getByRole('heading',{name:'Decision: Reserve funds'})).toBeVisible();
 await panel.getByRole('button',{name:'Repeat same seeds and verify'}).first().click();await expect(panel.getByRole('status')).toContainText('Replay verified');
 await expect(panel.locator('#crisis-history > li')).toHaveCount(2);
 await panel.getByText('Inspect immutable receipt and initial/final checkpoints').first().click();await expect(panel.locator('pre').first()).toContainText('"initialHash"');
});

test('missing and mismatched source refuse results; cancelled load and run retain history',async({page})=>{
 await page.route('**/challenges/crisis-demo.v1.json',route=>route.fulfill({status:404,body:'unavailable'}));
 await page.goto('/world/challenges.html#crisis-drill');const panel=page.getByRole('region',{name:'Crisis Judgment Drill'});
 await panel.getByRole('button',{name:'Load pinned demo'}).click();await expect(panel.getByRole('status')).toContainText('No source data');
 await expect(panel.locator('#crisis-history > li')).toHaveCount(0);
 await page.unroute('**/challenges/crisis-demo.v1.json');
 await page.route('**/challenges/crisis-demo.v1.json',async route=>{const response=await route.fetch();const body=await response.json();body.challenges[0].seed=99;await route.fulfill({json:body});});
 await panel.getByRole('button',{name:'Load pinned demo'}).click();await expect(panel.getByRole('status')).toContainText('mismatch');await expect(panel.getByRole('button',{name:'Commit decision and inspect'})).toBeDisabled();
 await page.unroute('**/challenges/crisis-demo.v1.json');
 // Hold the fetch so cancel is deterministic, rather than racing localhost latency.
 let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/challenges/crisis-demo.v1.json',async route=>{await held;await route.continue().catch(()=>{});});
 await panel.getByRole('button',{name:'Load pinned demo'}).click();await panel.getByRole('button',{name:'Cancel pending run'}).click();await expect(panel.getByRole('status')).toContainText('Cancelled');release();
 await page.unroute('**/challenges/crisis-demo.v1.json');
 await panel.getByRole('button',{name:'Load pinned demo'}).click();await expect(panel.getByRole('status')).toContainText('Objectives frozen');
 // Dispatch both UI actions in one task before the first simulation yield resumes.
 await panel.evaluate(root=>{root.querySelector('#crisis-run').click();root.querySelector('#crisis-cancel').click();});
 await expect(panel.getByRole('status')).toContainText('Cancelled');await expect(panel.locator('#crisis-history > li')).toHaveCount(0);
});
