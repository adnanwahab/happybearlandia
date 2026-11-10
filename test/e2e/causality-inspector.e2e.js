import {test,expect} from '@playwright/test';
test('inspector empty, recorded dependencies, keyboard tabs and error recovery',async({page})=>{
 await page.goto('/world/causality/inspect.html');
 await expect(page.getByRole('status')).toContainText('Choose a stored run');
 const record={id:'event:test:1',type:'recorded simulation',context:{tick:1},provenance:{kind:'simulated',source:'test'}};
 await page.route('**/api/causality/explain?**',route=>route.fulfill({json:{nodes:[record],edges:[],incomplete:true}}));
 await page.getByRole('textbox',{name:'Run',exact:true}).fill('run:test:1');
 await page.getByRole('textbox',{name:'Record',exact:true}).fill(record.id);
 await page.getByRole('button',{name:'Inspect',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Incomplete graph');
 await expect(page.getByRole('heading',{name:'recorded simulation'})).toBeVisible();
 await page.getByRole('tab',{name:'Why',exact:true}).focus();await page.keyboard.press('End');
 await expect(page.getByRole('tab',{name:'Evidence',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'History',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Could not load records');
 await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
});
