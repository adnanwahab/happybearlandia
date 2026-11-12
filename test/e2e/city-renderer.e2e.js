import {test,expect} from '@playwright/test';
test('WebGL2 fallback exposes quality, cutaway, feature toggles and benchmark stats',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world?demo=1&renderer=webgl&people=20');
 await page.waitForFunction(()=>window.hblCityRenderer?.getPerformanceStats().frames>3,null,{timeout:90000});
 await page.keyboard.press('F3');await expect(page.getByTestId('render-performance')).toBeVisible();
 await expect(page.getByLabel('Scene lighting',{exact:true})).toHaveValue('14');
 await page.getByLabel('Scene lighting',{exact:true}).selectOption('simulation');
 expect(await page.evaluate(()=>window.hblCityRenderer.timeOfDay)).toBeUndefined();
 await page.getByLabel('Scene lighting',{exact:true}).selectOption('14');
 const result=await page.evaluate(()=>{const api=window.hblCityRenderer;api.setQuality('LOW');api.setWeather('rain');api.setTimeOfDay(22);api.setFeature('traffic',false);api.setCutaway(true);api.focusBuilding(0);return api.getPerformanceStats();});
 expect(result.backend).toBe('webgl2');expect(result.quality).toBe('LOW');expect(result.features.traffic).toBe(false);
 await page.getByLabel('Geometry detail',{exact:true}).selectOption('HIGH');
 await page.getByLabel('Geometry debug',{exact:true}).selectOption('lod');
 await page.getByText('Wireframe selected',{exact:false}).click();
 expect(await page.evaluate(()=>window.hblCityRenderer.getGeometryStats().bytes)).toBeGreaterThan(0);
 await page.waitForTimeout(1000);expect(errors).toEqual([]);
});

test('close-up grass and an imported GLB render without shader errors',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/THREE|shader|WGSL|GLSL|WebGLProgram/i.test(message.text()))errors.push(message.text());});
 await page.goto('/world?demo=1&renderer=webgl&people=10');
 await page.waitForFunction(()=>!!window.hblCityRenderer,null,{timeout:90000});
 const park=await page.evaluate(async()=>{
  const {buildTown}=await import('/world/gen.js');
  const park=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:10}).buildings.find(b=>b.kind==='park');
  const api=window.hblCityRenderer;api.setTimeOfDay(14);api.setAdaptiveQuality(false);api.setQuality('BALANCED');api.focusDistrict({x:park.center[0],z:park.center[1],radius:3});
  await api.loadDetailAsset({url:'/world/render/assets/models/bench-preview.glb',maxDistance:100,transforms:[{position:[park.center[0]+1,.3,park.center[1]-2]}]});
  return park.center;
 });
 await page.waitForFunction(()=>{const grass=window.hblCityRenderer.getGeometryStats().grass;return grass.blades>100&&!grass.preparing;},null,{timeout:60000});
 const stats=await page.evaluate(()=>window.hblCityRenderer.getGeometryStats());expect(stats.grass.drawCalls).toBe(1);expect(stats.assets[0].instances).toBe(1);
 const style=await page.addStyleTag({content:'.panel,.bw-world-tools,[class*=minimap],[class*=map-controls],[class*=fps]{visibility:hidden!important}'});
 await page.screenshot({path:'/tmp/hbl-grass-closeup.png'});await style.evaluate(node=>node.remove());
 await page.evaluate(()=>window.hblCityRenderer.setFeature('grass',false));
 await page.waitForFunction(()=>window.hblCityRenderer.getGeometryStats().grass.blades===0);
 expect(park).toHaveLength(2);expect(errors).toEqual([]);
});

for (const backend of ['webgl2', 'canvas2d']) test(`detected ${backend} label survives unavailable WebGPU and usable controls`, async ({page}, info) => {
 test.setTimeout(120000);
 // Expose the API but deny adapters: capability presence must never become a WebGPU claim.
 await page.addInitScript(({blockWebGL}) => {
  Object.defineProperty(navigator, 'gpu', {configurable:true, value:{requestAdapter:async()=>null}});
  if (blockWebGL) {
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:getContext.call(this,type,...args);};
  }
 }, {blockWebGL:backend==='canvas2d'});
 await page.goto('/world?demo=1&people=10');
 await page.waitForFunction(()=>window.hblCityRenderer?.getPerformanceStats().frames>3,null,{timeout:90000});
 expect(await page.evaluate(()=>window.hblCityRenderer.getPerformanceStats().backend)).toBe(backend);
 await expect(page.locator('#source')).toContainText(`renderer ${backend.toUpperCase()}`);
 await expect(page.locator('#source')).not.toContainText('WEBGPU');
 await page.keyboard.press('F3');
 await expect(page.getByTestId('render-performance')).toBeVisible();
 await page.getByLabel('Scene lighting',{exact:true}).selectOption('22');
 await expect(page.getByLabel('Scene lighting',{exact:true})).toHaveValue('22');
 const stats=await page.evaluate(()=>{window.hblCityRenderer.setQuality('LOW');return window.hblCityRenderer.getPerformanceStats();});
 expect(stats.backend).toBe(backend);expect(stats.quality).toBe('LOW');
 await page.screenshot({path:info.outputPath(`detected-${backend}.png`)});
});

for (const fallback of ['webgl2', 'canvas2d']) {
 test(`adapter rejection retains model-backed World through ${fallback}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({fallback})=>{
   Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>{throw new Error('SHE-105 simulated adapter rejection');}}});
   if(fallback==='canvas2d'){
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};
   }
  },{fallback});
  await page.goto('/world/?demo=1&synthetic=1&people=20');
  await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready),{timeout:90000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.hblSimulationModel?.status)).toBe('ready');
  await expect(page.locator('#source')).toContainText('SHE-105 simulated adapter rejection');
  await expect(page.locator('#source')).toContainText(`renderer ${fallback.toUpperCase()}`);
  await expect(page.locator('#view canvas')).toBeVisible();
  const stats=await page.evaluate(()=>window.hblCityRenderer.getGeometryStats());
  expect(stats.bytes).toBeGreaterThan(0);
  await expect(page.locator('#world-playback-facts')).toContainText(/Mood: \d+ \/ 100 · Seed: .+/);
  await page.screenshot({path:testInfo.outputPath(`adapter-rejection-${fallback}.png`)});
  expect(errors).toEqual([]);
 });
}
