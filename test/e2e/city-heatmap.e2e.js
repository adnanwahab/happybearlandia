import {test,expect} from '@playwright/test';
test('heatmap switches recorded measures without changing model time',async({page},testInfo)=>{
 await page.goto('/world/bench/people');
 await page.evaluate(async()=>{
 const {mountCityHeatmap}=await import('/world/population/city-heatmap.js');
 document.body.innerHTML='<main style="width:440px;margin:auto"></main>';
 const heatmap=mountCityHeatmap(document.querySelector('main'));
 heatmap.update({cityHeatmap:{minute:60,tick:4,fromMinute:30,occupancy:[{id:'Home',x:0,z:0,count:1000,representedCount:1000000}],activity:[{id:'Cafe',x:100,z:100,count:2}],unmapped:0}});
 });
 await expect(page.getByRole('status')).toContainText('1000000 represented residents');
 await page.screenshot({path:testInfo.outputPath('occupancy.png')});
 await page.getByLabel('Heatmap measure').selectOption('activity');
 await expect(page.getByRole('status')).toContainText('2 recorded encounters');
 await expect(page.getByRole('status')).toContainText('Minute 60 · tick 4');
 await expect(page.locator('circle')).toHaveAttribute('fill-opacity','1');
 await page.screenshot({path:testInfo.outputPath('activity.png')});
});
