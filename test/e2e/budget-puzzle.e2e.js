import {test,expect} from '@playwright/test';
test('House navigation opens authored week, completes success and restarts matched inputs',async({page})=>{
 await page.route('**/api/world-homes',r=>r.fulfill({json:{homes:[]}}));
 await page.goto('/world/house');await page.getByRole('link',{name:'Play One Salary, Seven Days'}).click();
 await expect(page.getByRole('heading',{name:'One Salary, Seven Days',exact:true})).toBeVisible();
 for(let day=1;day<=7;day++){if(day===3||day===6)await page.getByRole('button',{name:'Buy 3 food · 12 credits',exact:true}).click();await page.getByRole('button',{name:'Finish day · consume 1 food',exact:true}).click();}
 await expect(page.getByRole('status')).toContainText('36 credits · 1 food · success');
 await expect(page.getByRole('list',{name:'Seven-day decision calendar'}).getByRole('listitem')).toHaveCount(7);
 await page.getByRole('button',{name:'Verify recorded replay'}).click();await expect(page.getByRole('status')).toContainText('success');
 await page.getByRole('button',{name:'Restart matched scenario'}).click();await expect(page.getByRole('status')).toContainText('100 credits · 2 food · playing');
 await page.getByRole('button',{name:'Cancel week'}).click();await expect(page.getByRole('status')).toContainText('cancelled');
 await page.getByRole('link',{name:'Back to saved homes'}).click();await expect(page.getByRole('heading',{name:'Your saved homes'})).toBeVisible();
});
test('mobile failure and missing scenario stay explicit',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/world/house?budgetPuzzle=1');
 for(let day=0;day<3;day++)await page.getByRole('button',{name:'Finish day · consume 1 food',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('failed. Daily food need unmet.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/world/house?budgetPuzzle=missing');await expect(page.getByRole('status')).toContainText('No source scenario available');
 await expect(page.getByRole('button',{name:'Finish day · consume 1 food',exact:true})).toHaveCount(0);
});
