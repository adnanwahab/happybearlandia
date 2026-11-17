// Known visibility blocker reproduction: captures an actual mapped-sidewalk trip.
// Nonzero exit deliberately keeps visual acceptance open; matrix presence is insufficient.
import{chromium,expect}from'@playwright/test';import{writeFile,mkdir}from'node:fs/promises';import{join}from'node:path';
 const artifacts=process.env.HBL_BROWSER_ARTIFACT_DIR||'/private/tmp/she990-main-evidence';
 await mkdir(artifacts,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal','--enable-unsafe-webgpu']});try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),report={errors:[],gpuErrors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/webgpu|GPUValidation|device.?lost/i.test(m.text()))report.gpuErrors.push(m.text());});
 await page.goto(`${process.env.HBL_BROWSER_BASE_URL||'http://127.0.0.1:43943'}/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline`);
 await page.waitForFunction(()=>window.hblPersonCommands&&hblWorldStartup?.readyMs,{timeout:90000});
 await page.locator('[data-launch-speed="4"]').click();
await page.waitForFunction(()=>hblWorldTileSource.getFrame().people.some(p=>p.mode==='moving'&&p.tripRouteKind==='mapped-sidewalk'&&p.pathI>0&&p.pathI<p.path.length-1),null,{timeout:100000});
 await page.locator('[data-launch=pause]').click();
 report.walker=await page.evaluate(()=>{const f=hblWorldTileSource.getFrame(),p=f.people.find(p=>p.mode==='moving'&&p.tripRouteKind==='mapped-sidewalk'&&p.pathI>0&&p.pathI<p.path.length-1);return{minute:f.minute,seed:hblSessionLogState().seed,person:p,rules:f.residentRules};});
 expect(report.walker.person).toBeTruthy();
 await page.locator('[data-launch=people]').click();
 await page.getByRole('searchbox',{name:'Find a resident'}).fill(report.walker.person.name);
 await page.locator('.launch-person-list button').filter({hasText:report.walker.person.name}).first().click();
 expect(await page.evaluate(()=>hblPersonCommands.getActor().id)).toBe(String(report.walker.person.id));
 await page.locator('#followBtn').click();
 await page.waitForFunction(()=>{const s=hblSessionLogState(),a=hblPersonCommands.getActor(),i=hblWorldTileSource.getFrame().people.findIndex(p=>String(p.id)===String(a.id)),m=hblHumanPeople.parts[0].instanceMatrix.array;return Math.hypot(s.target[0]-m[i*16+12],s.target[2]-m[i*16+14])<1;},null,{timeout:30000});
 await page.mouse.move(750,500);
 await page.mouse.wheel(0,-6500);
 await page.waitForTimeout(2500);
 await page.mouse.move(750,650);
 await page.mouse.down();
 await page.mouse.move(750,850,{steps:20});
 await page.mouse.up();
 await page.waitForTimeout(1000);
 report.render=await page.evaluate(()=>{const i=hblWorldTileSource.getFrame().people.findIndex(p=>String(p.id)===hblPersonCommands.getActor().id),part=hblHumanPeople.parts[0],a=part.instanceMatrix.array,o=i*16;return{state:hblSessionLogState(),id:i,position:[a[o+12],a[o+13],a[o+14]],scale:Math.hypot(a[o],a[o+1],a[o+2]),asset:hblHumanPeople.assetStatus};});
 expect(report.render.scale).toBeGreaterThan(0);
 await page.screenshot({path:join(artifacts,'sidewalk-closeup.png')});
 report.visibilityAccepted=false;
 report.manualReviewRequired=true;
 report.limitation='A nonzero mesh and mapped-sidewalk route do not establish visible sidewalk geometry. Captured candidate was occluded in reviewed street/overhead angles; rendered position lags paused model position.';
 process.exitCode=1;
 await writeFile(join(artifacts,'sidewalk.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({minute:report.walker.minute,id:report.walker.person.id,pathI:report.walker.person.pathI,pathLength:report.walker.person.path.length,render:report.render,errors:report.errors,gpu:report.gpuErrors}));}finally{await browser.close();}
