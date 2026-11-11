import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
const threeBuild=dirname(createRequire(import.meta.url).resolve('three'));

for(const {gpuAbsent,renderer} of [{gpuAbsent:false,renderer:'canvas2d'},{gpuAbsent:true,renderer:'canvas2d'},{gpuAbsent:true,renderer:'auto'}])for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`ordinary Living Canvas ${viewport.width}px GPU absent=${gpuAbsent} renderer=${renderer}`,async({page},testInfo)=>{
 const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
 await page.setViewportSize(viewport);await page.addInitScript(()=>{window.__canvasRuntimeErrors=[];addEventListener('error',e=>window.__canvasRuntimeErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__canvasRuntimeErrors.push(String(e.reason?.message??e.reason)));});
 if(gpuAbsent)await page.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl|webgpu/i.test(type)?null:original.call(this,type,...args);};});
 // Isolated worktrees omit node_modules; serve the installed, unmodified Three assets.
 await page.route('**/vendor/three/**',async route=>{const name=new URL(route.request().url()).pathname.slice('/vendor/three/'.length);const path=name.startsWith('addons/')?join(threeBuild,'../examples/jsm',name.slice(7)):join(threeBuild,name);await route.fulfill({body:await readFile(path),contentType:'text/javascript'});});
 try{
  await page.goto('/world/?synthetic=1&people=30'+(renderer==='auto'?'':'&renderer=canvas2d'));
  await page.waitForFunction(()=>window.hblWorldStartup?.readyMs||window.__canvasRuntimeErrors?.length||document.querySelector('#loading')?.getAttribute('role')==='alert',null,{timeout:60000});
  expect(errors).toEqual([]);
  await expect(page.locator('canvas[data-renderer="canvas2d"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld?.active===true),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.hblWorldActivity?.getSnapshot()?.mode)).toBe('living');
  await expect.poll(()=>page.evaluate(()=>window.hblWorldActivity?.getSnapshot()?.peopleCount??0),{timeout:30000}).toBeGreaterThan(0);
  await page.locator('#top > summary').click();await page.locator('#speeds [data-s="0"]').click();await page.locator('#top > summary').click();
  const snapshot=await page.evaluate(()=>({activity:window.hblWorldActivity.getSnapshot(),living:window.hblLivingWorld.getSnapshot(),startup:window.hblWorldStartup}));
  expect(snapshot.living.runtime.paused).toBe(true);expect(snapshot.activity.peopleCount).toBe(snapshot.living.config.population);expect(snapshot.activity.peopleCount).toBeGreaterThan(0);expect(snapshot.activity.people.length).toBeGreaterThan(0);expect(snapshot.activity.runId).toBe(`${snapshot.living.runtime.id}:${snapshot.living.runtime.revision}`);
  const id=String(snapshot.activity.people[0].id??snapshot.activity.people[0].personId);
  await page.evaluate(id=>window.hblWorldActivity.selectPerson(id),id);await expect.poll(()=>page.evaluate(()=>String(window.hblLivingWorld.getSelection()?.id??window.hblLivingWorld.getSelection()?.personId))).toBe(id);
  await expect(page.getByRole('dialog',{name:'Person details',exact:true})).toContainText(id);await page.getByRole('button',{name:'Close person details',exact:true}).click();
  await page.getByRole('button',{name:'Activity dashboard',exact:true}).click();await expect(page.locator('.activity-dashboard')).toBeVisible();
  const history=await page.evaluate(()=>window.hblWorldActivity.getHistory({includeBuckets:true,includeEvents:true}));expect(history.runId).toBe(snapshot.activity.runId);await page.screenshot({path:testInfo.outputPath('living-activity.png'),fullPage:true});await page.locator('.activity-dashboard').getByRole('button',{name:'Close',exact:true}).click();
  const colors=await page.locator('canvas[data-renderer="canvas2d"]').evaluate(el=>{const ctx=el.getContext('2d'),colors=new Set();for(let x=0;x<el.width;x+=40)for(let y=0;y<el.height;y+=40)colors.add([...ctx.getImageData(x,y,1,1).data].join(','));return colors.size;});expect(colors).toBeGreaterThan(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{
  await page.screenshot({path:testInfo.outputPath('ordinary-living-canvas.png'),fullPage:true});
  const evidence=await page.evaluate(()=>({startup:window.hblWorldStartup,model:window.hblSimulationModel,active:window.hblLivingWorld?.active,activity:window.hblWorldActivity?.getSnapshot?.(),renderer:window.hblCityRenderer?.getPerformanceStats?.(),loading:document.querySelector('#loading')?.textContent}));
  const evidencePath=testInfo.outputPath('runtime-evidence.json');await writeFile(evidencePath,JSON.stringify({gpuAbsent,renderer,viewport,evidence,errors,consoleErrors},null,2));await testInfo.attach('runtime-evidence',{path:evidencePath,contentType:'application/json'});console.log('WORLD_CANVAS_LIVING',JSON.stringify({gpuAbsent,viewport,active:evidence.active,mode:evidence.activity?.mode,population:evidence.activity?.peopleCount,seed:evidence.activity?.config?.seed,modelAuthority:evidence.model?.authority,loading:evidence.loading,errors,consoleErrors}));
 }
});
