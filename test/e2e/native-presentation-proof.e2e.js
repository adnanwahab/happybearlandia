import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

async function seek(page,month){
 const slider=page.getByTestId('future-machine-timeline');
 await slider.fill(String(month));await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
 // Capture the presented frame after layout/command submission, never the
 // WebGPU canvas backbuffer, which may already have been discarded.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function save(info,name,value){await writeFile(info.outputPath(`${name}.json`),JSON.stringify(value,null,2));}

async function capture(page,info,name,hardware,errors){
 const canvas=page.getByTestId('future-machine-stage').locator('canvas').first();
 await canvas.scrollIntoViewIfNeeded();
 const bounds=await canvas.boundingBox();
 const png=await canvas.screenshot({path:info.outputPath(`${name}-canvas.png`)});
 const runtime=await page.evaluate(()=>{
  const api=window.futureMachine,h=api.history,s=api.state;
  let firstDivergence=null;
  for(let month=0;month<h.plan.length;month++){
   const added=h.plan[month].state.buildings.find(row=>!h.baseline[month].state.buildings.some(before=>before.id===row.id));
   if(added){firstDivergence={month,collection:'buildings',id:added.id,building:added};break;}
  }
  return {schemaVersion:'native-presentation-proof.v1',recipe:h.recipe,seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,runId:h.experimentId,selectedMonth:s.month,metrics:s.diff.metrics,firstDivergence,scene:api.stats.scene,baseline:h.baseline[s.month],plan:h.plan[s.month],evidence:h.plan.slice(0,s.month+1).flatMap(snapshot=>snapshot.events.map(event=>({arm:'plan',snapshotMonth:snapshot.month,...event}))),provenance:h.provenance};
 });
 const pixels=await page.evaluate(async({png,bounds,targets})=>{
  const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
  const original=document.createElement('canvas');original.width=image.width;original.height=image.height;
  const originalContext=original.getContext('2d');originalContext.drawImage(image,0,0);
  // Downsampling reduces subpixel/AA noise from fractional split widths. Crop
  // three CSS pixels from each side so the viewport seam is not counted.
  const width=256,height=192,halves=[];
  for(let arm=0;arm<2;arm++){
   const sample=document.createElement('canvas');sample.width=width;sample.height=height;
   const ctx=sample.getContext('2d');ctx.drawImage(image,arm*image.width/2+3,3,image.width/2-6,image.height-6,0,0,width,height);
   halves.push(ctx.getImageData(0,0,width,height).data);
  }
  let changed=0,totalDelta=0;const nonempty=[0,0],foreground=[0,0],brightEdges=[0,0];let left=width,top=height,right=-1,bottom=-1;
  for(let pixel=0;pixel<width*height;pixel++){
   const offset=pixel*4;let delta=0;
   for(let channel=0;channel<3;channel++)delta+=Math.abs(halves[0][offset+channel]-halves[1][offset+channel]);
   totalDelta+=delta;
   if(delta>54){changed++;const x=pixel%width,y=Math.floor(pixel/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   for(let arm=0;arm<2;arm++){
    const rgb=Array.from(halves[arm].slice(offset,offset+3));
    if(Math.max(...rgb)-Math.min(...rgb)>8)nonempty[arm]++;
    // Bright inventory surfaces, not merely the dark grid/background.
    if(Math.max(...rgb)>90){foreground[arm]++;const x=pixel%width;if(x<2||x>=width-2)brightEdges[arm]++;}
   }
  }
  const targetPixels=targets.map(target=>{
   const x=target.x*image.width/bounds.width,y=target.y*image.height/bounds.height;
   const inside=x>=3&&x<image.width-3&&y>=3&&y<image.height-3;
   if(!inside)return {...target,inside:false};
   const data=originalContext.getImageData(Math.max(0,Math.floor(x)-5),Math.max(0,Math.floor(y)-5),11,11).data;let brightest=0;
   for(let i=0;i<data.length;i+=4)brightest=Math.max(brightest,data[i],data[i+1],data[i+2]);
   return {...target,inside:true,brightest};
  });
  return {sourceSize:{width:image.width,height:image.height},normalizedSize:{width,height},threshold:{rgbSum:54},changedPixels:changed,changedFraction:changed/(width*height),meanAbsoluteChannelDelta:totalDelta/(width*height*3),changedBounds:changed?{left,top,right,bottom}:null,nonemptyFractions:nonempty.map(n=>n/(width*height)),brightInventoryPixels:foreground,brightEdgePixels:brightEdges,targetPixels};
 },{png:png.toString('base64'),bounds,targets:runtime.scene.targets.filter(target=>target.collection==='buildings')});
 await save(info,name,{...runtime,hardware,pixels,consoleErrors:errors.console,pageErrors:errors.page,canvasBounds:bounds});
 await page.screenshot({path:info.outputPath(`${name}-page.png`),fullPage:true});
 return {...runtime,pixels,bounds};
}

for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 test(`native Metal City presentation at ${viewport.width}px: matched start, localized Month 16 difference`,async({page,browser},info)=>{
  const errors={page:[],console:[]};
  page.on('pageerror',e=>errors.page.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text());});
  await page.setViewportSize(viewport);
  await page.goto('/world/future-machine.html');
  await page.getByRole('button',{name:'Fork City',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
  const adapter=await page.evaluate(async()=>{
   try{const gpu=await navigator.gpu?.requestAdapter();return {available:!!gpu,info:gpu?{vendor:gpu.info?.vendor,architecture:gpu.info?.architecture,device:gpu.info?.device,description:gpu.info?.description}:null};}
   catch(e){return {available:false,error:e.message};}
  });
  const hardware={adapter,browser:browser.version(),launchArgs:info.project.use.launchOptions.args,sourceRoot:process.env.HBL_NATIVE_PROOF_SOURCE_ROOT||process.cwd(),nativeFlag:process.env.HBL_NATIVE_WEBGPU||null,angle:process.env.HBL_BACKEND_ANGLE||null};
  await seek(page,0);const initial=await capture(page,info,`${viewport.width}-month-0`,hardware,errors);
  expect(initial.scene.backend,'Native proof requires the actual WebGPU backend; fallback is not native acceptance').toBe('webgpu');
  expect(adapter.available).toBe(true);expect(initial.seed).toBe(42);expect(initial.baseline.state).toEqual(initial.plan.state);
  expect(initial.firstDivergence.month).toBe(16);expect(initial.metrics.housingUnits.delta).toBe(0);
  expect(initial.pixels.meanAbsoluteChannelDelta).toBeLessThan(3);
  expect(initial.pixels.changedFraction).toBeLessThan(.03);
  for(const count of initial.pixels.brightInventoryPixels)expect(count,'Each half must contain bright city inventory pixels').toBeGreaterThan(10);
  for(const target of initial.pixels.targetPixels){expect(target.inside).toBe(true);expect(target.brightest).toBeGreaterThan(70);}
  const camera=initial.scene.camera;
  await seek(page,16);const changed=await capture(page,info,`${viewport.width}-month-16`,hardware,errors);
  expect(changed.scene.camera).toEqual(camera);expect(changed.scene.backend).toBe('webgpu');
  expect(changed.metrics.housingUnits.delta).toBe(24);expect(changed.metrics.capitalSpending.delta).toBe(1000000);
  expect(changed.evidence.some(e=>e.eventType==='PROJECT_COMPLETE')).toBe(true);
  expect(changed.pixels.changedPixels).toBeGreaterThan(initial.pixels.changedPixels+10);
  expect(changed.pixels.changedFraction).toBeGreaterThan(.0005);
  expect(changed.pixels.changedFraction,'Recorded physical divergence should remain localized').toBeLessThan(.2);
  for(const count of changed.pixels.brightInventoryPixels)expect(count).toBeGreaterThan(10);
  const added=changed.pixels.targetPixels.find(target=>target.id===changed.firstDivergence.id&&target.arm==='plan');
  expect(added).toBeTruthy();expect(added.inside).toBe(true);expect(added.brightest).toBeGreaterThan(90);
  // Check every recorded building center in its own shared-camera viewport,
  // rather than accepting a full-width canvas whose city was clipped offscreen.
  for(const target of changed.pixels.targetPixels){
   const start=target.arm==='plan'?changed.bounds.width/2:0;
   expect(target.x).toBeGreaterThan(start+3);expect(target.x).toBeLessThan(start+changed.bounds.width/2-3);
   expect(target.y).toBeGreaterThan(3);expect(target.y).toBeLessThan(changed.bounds.height-3);
  }
  const layout=await page.evaluate(()=>{
   const nav=document.querySelector('nav[aria-label="Connected universe"]');
   const box=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
   const n=nav?box(nav):null;
   const overlaps=n?[...document.querySelectorAll('.fm-ui button,.fm-ui input,.fm-ui select')].filter(node=>node.getClientRects().length&&!node.closest('details:not([open])')).filter(node=>{const r=box(node);return n.left<r.right&&n.right>r.left&&n.top<r.bottom&&n.bottom>r.top;}).map(node=>node.textContent||node.getAttribute('aria-label')||node.tagName):[];
   return {nav:n,overlaps,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  await save(info,`${viewport.width}-layout-console`,{layout,errors,hardware});
  expect(layout.nav).toBeTruthy();expect(layout.overlaps).toEqual([]);expect(layout.overflow).toBe(false);
  for(const count of changed.pixels.brightEdgePixels)expect(count,'Bright building surfaces or labels must not be cut by a viewport edge').toBe(0);
  expect(errors).toEqual({page:[],console:[]});
 });
}
