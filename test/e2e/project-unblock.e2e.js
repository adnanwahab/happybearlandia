import {test,expect} from '@playwright/test';
import {createCity} from '../../world/city/seed.js';
test('saved future inspector tests sewer capacity, preserves source and clears stale results',async({page,request})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state=createCity({households:9});state.parcels.forEach(p=>p.capacity=0);state.parameters.annualGrowth=0;
  for(const u of state.utilities)u.capacity=1000;state.utilities.find(u=>u.districtId==='d0'&&u.type==='sewer').capacity=0;
  state.projects.push({id:'sewer-stalled',districtId:'d0',type:'housing',stage:'construction',units:20,amount:20,duration:1,progress:0,cost:100,costOverrun:0,displacedUnits:[],displacedBusinesses:[]});
  const created=await request.post('/api/city-experiments',{data:{initial:state,runs:1,months:3,scenarios:[{id:'baseline',interventions:[]}]}});expect(created.status()).toBe(202);const {id}=await created.json();
  await expect.poll(async()=>{const response=await request.get(`/api/city-experiments/${id}`);return (await response.json()).status;}).toBe('complete');
  await page.goto(`/world/city-lab.html?experiment=${id}`);await expect(page.locator('#status')).toContainText('complete');await page.getByRole('button',{name:'Enter future',exact:true}).first().click();await page.locator('#replay').click();await expect(page.locator('#status')).toContainText('Future regenerated');
  const inspector=page.locator('#project-unblock');await inspector.locator('[data-inspect]').click();await expect(inspector.locator('[data-evidence]')).toContainText('utility capacity');await expect(inspector.locator('[data-resource]')).toHaveValue('sewer');
  await inspector.locator('[data-amount]').fill('200');await inspector.locator('[data-cost]').fill('12345');await inspector.locator('[data-months]').fill('3');await inspector.locator('[data-test]').click();
  await expect(inspector.locator('[data-status]')).toContainText('Comparison complete');await expect(inspector.locator('[data-result]')).toContainText('Month 2');await expect(inspector.locator('[data-result]')).toContainText('$12,345');await expect(inspector.locator('[data-result]')).toContainText('original remains unfinished');
  const download=page.waitForEvent('download');await inspector.getByRole('link',{name:'Download comparison evidence (JSON)'}).click();expect((await download).suggestedFilename()).toBe('project-unblock-comparison.json');
  await page.locator('#timeline').fill('2');await expect(inspector.locator('[data-result]')).toBeEmpty();await expect(inspector.locator('[data-status]')).toContainText('Saved month 2');
  await inspector.locator('[data-inspect]').click();await expect(inspector.locator('[data-evidence]')).toContainText('utility capacity');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
