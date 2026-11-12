import {test,expect} from '@playwright/test';
const route='/world/future-machine.html?renderer=canvas2d';
const key='hbl.future-machine.recent.v1';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
const month=(page,value)=>page.locator('input[type=range]').first().evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
const snapshot=page=>page.evaluate(()=>({recipe:window.futureMachine.history.recipe,id:window.futureMachine.history.experimentId,month:window.futureMachine.state.month,hash:window.futureMachine.history.initialHash}));
test('opt-in persists exact displayed run, resumes on bare entry, clear prevents future writes',async({page},info)=>{
  await page.goto(route);await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await month(page,73);
  await page.getByRole('button',{name:'Remember this comparison',exact:true}).click();
  const original=await snapshot(page);
  // Pending input must never replace the recipe of displayed results.
  await page.getByLabel('Seed for next run').fill('123');
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  expect(stored).toEqual({recipe:original.recipe,experimentId:original.id,month:73});
  await page.goto(route);await ready(page);expect(await snapshot(page)).toEqual(original);
  await page.screenshot({path:info.outputPath('continued-comparison.png'),fullPage:true});
  await page.getByRole('button',{name:'Clear saved comparison',exact:true}).click();
  await month(page,99);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await page.goto(route);await expect(page.getByRole('button',{name:'Remember this comparison',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();
});
test('missing saved record is explicitly recomputed; explicit share wins over local context',async({page})=>{
  await page.goto(route);await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
  const link=page.url();const original=await snapshot(page);
  await page.evaluate(({key,original})=>localStorage.setItem(key,JSON.stringify({recipe:original.recipe,experimentId:'city_missing_recent',month:40})),{key,original});
  await page.goto(route);await ready(page);await expect(page.locator('.fm-status')).toContainText('Saved record unavailable');
  expect((await snapshot(page)).recipe).toEqual(original.recipe);expect((await snapshot(page)).month).toBe(40);
  await page.goto(link);await ready(page);expect(await snapshot(page)).toEqual(original);
});
test('incompatible and blocked storage have clear feedback and usable reset',async({page})=>{
  await page.goto(route);
  await page.evaluate(key=>localStorage.setItem(key,'{"expired":true}'),key);
  await page.reload();await expect(page.getByRole('region',{name:'Local continuation'})).toContainText('invalid or expired');
  await page.getByRole('button',{name:'Clear saved comparison',exact:true}).click();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage denied');}});});
  await page.goto(route);await expect(page.getByRole('region',{name:'Local continuation'})).toContainText('Storage denied');
  await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
  await page.getByRole('button',{name:'Remember this comparison',exact:true}).click();await expect(page.getByRole('region',{name:'Local continuation'})).toContainText('Storage denied');
  await page.getByRole('button',{name:'Clear saved comparison',exact:true}).click();await expect(page.getByRole('region',{name:'Local continuation'})).toContainText('Could not clear');
});
