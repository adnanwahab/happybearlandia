import {test,expect} from '@playwright/test';
test('City Lab normal entry opens the jury, inspects inputs, revises and clears without a stale vote',async({page})=>{
 await page.goto('/world/city-lab.html');
 const jury=page.getByRole('region',{name:'Zoning Jury',exact:true});
 await expect(jury).toContainText('No source data');
 await jury.getByRole('button',{name:'Run pinned jury demo'}).click();
 await expect(jury.getByRole('status')).toContainText('2 / 3 support');
 await expect(jury.getByRole('heading',{name:'Renters',exact:true})).toBeVisible();
 await jury.getByText('Inspect immutable checkpoint inputs and replay evidence').click();
 await expect(jury.locator('pre')).toContainText('city-systems.');
 await jury.getByLabel('Jury proposal').selectOption('zoning');
 await expect(jury.getByRole('status')).toContainText('Proposal changed');
 await expect(jury.locator('article')).toHaveCount(0);
 await jury.getByRole('button',{name:'Run pinned jury demo'}).click();
 await expect(jury.getByRole('status')).toContainText('1 / 3 support');
 await jury.getByRole('button',{name:'Clear jury evidence'}).click();
 await expect(jury.getByRole('status')).toContainText('No source data');
});
test('missing source and replay mismatch withhold results',async({page})=>{
 await page.route('**/world/city/jury/demo.json',r=>r.fulfill({status:404,body:'missing'}));
 await page.goto('/world/city-lab.html');
 const jury=page.getByRole('region',{name:'Zoning Jury',exact:true});
 await jury.getByRole('button',{name:'Run pinned jury demo'}).click();
 await expect(jury.getByRole('status')).toContainText('No source data');
 await page.unroute('**/world/city/jury/demo.json');
 await page.route('**/world/city/jury/demo.json',async route=>{
  const response=await route.fetch(),data=await response.json();data.housing.plan.seed=99;
  await route.fulfill({json:data});
 });
 await jury.getByRole('button',{name:'Run pinned jury demo'}).click();
 await expect(jury.getByRole('status')).toContainText('Replay mismatch');
 await expect(jury.locator('article')).toHaveCount(0);
});
test('cancel while source is pending prevents a late vote',async({page})=>{
 await page.route('**/world/city/jury/demo.json',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue();});
 await page.goto('/world/city-lab.html');
 const jury=page.getByRole('region',{name:'Zoning Jury',exact:true});
 await jury.getByRole('button',{name:'Run pinned jury demo'}).click();
 await jury.getByRole('button',{name:'Cancel jury'}).click();
 await expect(jury.getByRole('status')).toContainText('Cancelled');
 await expect(jury.locator('article')).toHaveCount(0);
});
