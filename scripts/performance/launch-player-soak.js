/** Automated local journeys. Emulation is not physical phone/laptop/Safari proof. */
import {chromium,webkit} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const profile=process.argv[2]||'phone',seconds=Number(process.argv[3]||600);
const profiles={phone:{engine:chromium,viewport:{width:390,height:844},isMobile:true,hasTouch:true,throttle:1},'slow-laptop':{engine:chromium,viewport:{width:1280,height:800},throttle:4},webkit:{engine:webkit,viewport:{width:1280,height:800},throttle:1}};
if(!profiles[profile]||!Number.isInteger(seconds)||seconds<10||seconds>900)throw Error('Choose phone, slow-laptop or webkit and 10–900 seconds.');
const base=process.env.HBL_LAUNCH_TEST_URL||'http://127.0.0.1:39972';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Local server required.');
const source={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:{}};for(const path of ['world/render.js','world/sim.js','world/launch-shell.js','world/launch-context.js','world/world-gpu.js','world/renderer-entry.js','world/render/route-prewarmer.js','world/static-city.js','world/static-city-model.js'])source.hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
const config=profiles[profile],out=`artifacts/she-789/soak/${profile}`;await mkdir(out,{recursive:true});
const browser=await config.engine.launch({headless:true,...(profile!=='webkit'?{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}: {})});
const context=await browser.newContext({viewport:config.viewport,isMobile:config.isMobile??false,hasTouch:config.hasTouch??false,recordVideo:{dir:out,size:config.viewport}});
const page=await context.newPage(),errors=[],actions=[],simulationRequests=[];let cdp,workersCreated=0;
page.on('pageerror',error=>errors.push({message:error.message,stack:error.stack}));page.on('worker',()=>workersCreated++);page.on('request',r=>{const path=new URL(r.url()).pathname;if(/\/(sim\.js|population\/|render\.js|simulation-playback\.js)/.test(path))simulationRequests.push(path);});
if(config.throttle>1){cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:config.throttle});}
async function runStaticSoak(){
 const start=Date.now(),initial=await page.evaluate(()=>window.hblStaticCity.getState());let index=0;
 while(Date.now()-start<seconds*1000){const action=['fit','inspect','orbit','zoom'][index++%4];try{const before=await page.evaluate(()=>window.hblStaticCity.getState().draws);
  if(action==='fit')await page.getByRole('button',{name:'Fit city',exact:true}).click();
  else if(action==='inspect'){const options=page.locator('#inventory option'),count=await options.count(),id=await options.nth(1+index%(count-1)).getAttribute('value');await page.locator('#inventory').selectOption(id);await page.locator('#details').filter({hasText:`ID: ${id}`}).waitFor();}
  else{const box=await page.locator('#view canvas').boundingBox(),x=box.x+box.width*.6,y=box.y+box.height*.6;await page.mouse.move(x,y);if(action==='orbit'){await page.mouse.down();await page.mouse.move(x+24,y-12,{steps:8});await page.mouse.up();}else await page.mouse.wheel(0,index%2?100:-100);}
  await page.waitForTimeout(50);const after=await page.evaluate(()=>window.hblStaticCity.getState().draws);if(after<=before)throw Error('The city action did not request a draw.');actions.push({second:(Date.now()-start)/1000,action,ok:true});
 }catch(error){actions.push({second:(Date.now()-start)/1000,action,ok:false,error:error.message});}
 if(index%4===0)console.log(JSON.stringify({profile,viewOnly:true,elapsedSeconds:Math.round((Date.now()-start)/1000),actions:actions.length,pageErrors:errors.length,failed:actions.filter(a=>!a.ok).length}));
 await page.waitForTimeout(Math.min(15000,Math.max(0,seconds*1000-(Date.now()-start))));}
 const final=await page.evaluate(()=>window.hblStaticCity.getState());await page.screenshot({path:`${out}/final.png`});const report={profile,source,status:errors.length||actions.some(a=>!a.ok)||workersCreated||simulationRequests.length?'failed':'passed',viewOnly:true,requestedSeconds:seconds,elapsedSeconds:(Date.now()-start)/1000,initial,final,errors,actions,workersCreated,simulationRequests,summary:{renderedDraws:final.draws-initial.draws,continuousFps:null},limitations:['Desktop WebKit runner, not a physical Safari/device qualification.','WebGL2 city geometry only; no residents, worker model or simulation clock.','Rendering is on demand: recording frame rate or RAF cadence is not a continuous game FPS.']};await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({profile,status:report.status,viewOnly:true,summary:report.summary,errors,failedActions:actions.filter(a=>!a.ok),workersCreated,simulationRequests}));if(report.status!=='passed')process.exitCode=1;
}
try{
 await page.goto(base+'/world?demo=1&people=60&quality=LOW',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.hblStaticCity?.getState()?.ready||window.hblWorldStartup?.readyMs&&window.hblPersonCommands||window.hblWorldStartup?.graphicsError||document.querySelector('#loading[role=alert]'),null,{timeout:120000});
 const graphicsError=await page.evaluate(()=>window.hblWorldStartup?.graphicsError??document.querySelector('#loading[role=alert]')?.textContent);if(graphicsError){const error=new Error(graphicsError);error.code='unsupported-webgpu';throw error;}
 if(await page.evaluate(()=>Boolean(window.hblStaticCity?.getState()?.ready))){await runStaticSoak();}else{
 await page.evaluate(()=>{window.__soak={frames:[],start:performance.now(),last:null};function tick(now){const s=window.__soak;if(!s)return;if(now<s.start){requestAnimationFrame(tick);return;}if(s.last!==null)s.frames.push(now-s.last);s.last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 const start=Date.now();let index=0;
 while(Date.now()-start<seconds*1000){
  const action=['people','play','walk','pause','resume','overlay','tiles','quests','legends','search'][index++%10];
  try{
   if(!['play','walk'].includes(action))await page.keyboard.press('Escape');
   if(action==='people'){await page.locator('[data-launch=people]').click();const first=page.locator('.launch-person-list button').first();if(await first.count())await first.click();}
   else if(action==='play'){const b=page.getByRole('button',{name:'Play as resident',exact:true});await b.waitFor({state:'visible'});await b.click();}
   else if(action==='walk'){if(!await page.evaluate(()=>window.hblPersonCommands.getState().controlled))throw Error('Resident control did not start.');await page.keyboard.press(index%2?'d':'w');await page.locator('[data-command-status]').filter({hasText:/accepted|walking|trip|minutes/i}).waitFor();}
   else if(action==='pause')await page.locator('[data-launch=pause]').click();
   else if(action==='resume')await page.locator('[data-launch-speed="2"]').click();
   else if(action==='overlay')await page.locator('[data-launch=overlay]').click();
   else if(action==='tiles'){await page.locator('[data-launch=tiles]').click();await page.getByRole('dialog',{name:'World tile view'}).waitFor();await page.locator('.world-tiles canvas').focus();await page.keyboard.press('ArrowRight');}
   else{await page.locator(`[data-launch=${action}]`).click();await page.locator('#launch-panel').waitFor({state:'visible'});}
   actions.push({second:(Date.now()-start)/1000,action,ok:true});
  }catch(error){actions.push({second:(Date.now()-start)/1000,action,ok:false,error:error.message});}
  if(index%4===0)console.log(JSON.stringify({profile,elapsedSeconds:Math.round((Date.now()-start)/1000),actions:actions.length,pageErrors:errors.length,failed:actions.filter(a=>!a.ok).length}));
  await page.waitForTimeout(Math.min(15000,Math.max(0,seconds*1000-(Date.now()-start))));
 }
 const result=await page.evaluate(()=>{const s=window.__soak;delete window.__soak;return{frames:s.frames,userAgent:navigator.userAgent,mode:document.documentElement.dataset.renderer??'3d',renderStats:window.hblCityRenderer?.getPerformanceStats?.(),source:window.hblWorldTileSource?.getFrame?.()?{runId:window.hblWorldTileSource.getFrame().runId,minute:window.hblWorldTileSource.getFrame().minute,seed:window.hblWorldTileSource.getFrame().seed}:null};});
 const sorted=result.frames.toSorted((a,b)=>a-b);result.summary={count:sorted.length,medianMs:sorted[Math.floor(sorted.length*.5)],p99Ms:sorted[Math.floor(sorted.length*.99)],maxMs:sorted.at(-1),over50:sorted.filter(n=>n>50).length,rafHz:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length)};
 await page.keyboard.press('Escape');await page.screenshot({path:`${out}/final.png`});
 const report={profile,source,requestedSeconds:seconds,elapsedSeconds:(Date.now()-start)/1000,viewport:config.viewport,cpuThrottle:config.throttle,errors,actions,...result,limitations:['Automated desktop-host browser journey; not physical phone or old laptop.','WebKit is a browser-engine approximation, not a certified Safari/device run.','Video capture and any concurrent local work affect timing; RAF cadence is not a display hardware FPS measurement.','Pinned synthetic geometry,60 residents,LOW quality; default-scale performance measured separately.']};
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({profile,summary:report.summary,errors,failedActions:actions.filter(a=>!a.ok)}));
 if(errors.length||actions.some(a=>!a.ok))process.exitCode=1;
}
}catch(error){const report={profile,source,status:error.code==='unsupported-webgpu'?'unsupported-webgpu':'failed',requestedSeconds:seconds,error:error.message,errors,actions,limitations:['Desktop browser engine/emulation, not a physical-device result.','A WebGPU requirement failure is not a completed ten-minute playtest.']};await page.screenshot({path:`${out}/startup-failure.png`}).catch(()=>{});await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=error.code==='unsupported-webgpu'?2:1;}finally{await context.close();await browser.close();}
