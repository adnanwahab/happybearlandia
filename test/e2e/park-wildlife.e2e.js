import {test,expect} from '@playwright/test';
for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`optional decorative creatures ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize(viewport);
 await page.goto('/world?demo=1&synthetic=1&people=16&renderer=webgl');
 await page.waitForFunction(()=>window.hblCityRenderer?.getPerformanceStats().frames>3,null,{timeout:90000});
 await page.evaluate(async()=>{
  const {buildTown}=await import('/world/gen.js');
  const park=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:16}).buildings.find(b=>b.kind==='park');
  const api=window.hblCityRenderer;api.setAdaptiveQuality(false);api.setQuality('BALANCED');api.focusDistrict({x:park.center[0],z:park.center[1],radius:3});
 });
 await page.getByRole('button',{name:'Open graphics settings'}).click();
 const checkbox=page.getByRole('checkbox',{name:'Decorative park creatures (not simulated animals)'});
 await expect(checkbox).not.toBeChecked();
 await page.screenshot({path:info.outputPath('before.png')});
 await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked();
 await page.waitForFunction(()=>window.hblCityRenderer.getPerformanceStats().wildlife.visible>0);
 await page.screenshot({path:info.outputPath('after.png')});
 await page.evaluate(()=>{const api=window.hblCityRenderer;for(let i=0;i<60;i++){api.setTimeOfDay(i%24);api.focusDistrict({x:i*100,z:-i*100,radius:i%2?3:100});}});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>window.hblCityRenderer.getPerformanceStats().wildlife.visible===0);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('combobox',{name:'Render quality',exact:true}).selectOption('LOW');
 await page.waitForFunction(()=>window.hblCityRenderer.getPerformanceStats().wildlife.visible===0);
 const disposed=await page.evaluate(()=>{const api=window.hblCityRenderer;dispatchEvent(new Event('pagehide'));return api.getPerformanceStats().wildlife.disposed;});
 expect(disposed).toBe(true);
 await page.goto('/');
});
