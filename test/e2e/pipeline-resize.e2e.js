import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const buildingId='building-project-policy-1-0';
async function measured(page){return page.evaluate(async id=>{
 const api=window.futureMachine,h=api.history,s=api.state,stats=api.stats.scene;
 const stage=document.querySelector('[data-testid="future-machine-stage"]'),canvas=stage.querySelector('canvas'),box=canvas.getBoundingClientRect();
 const {createSpatialMapping}=await import('/world/future-machine/scene/mapping.js');const mapping=createSpatialMapping();for(let m=0;m<=120;m++)mapping.frame(h.baseline[m].state,h.plan[m].state);
 const row=mapping.frame(h.baseline[s.month].state,h.plan[s.month].state).b.find(row=>row.id===id);
 const width=box.width,height=box.height,half=width/2;let points,label;
 if(stats.backend==='webgpu'){
  const THREE=await import('three'),camera=new THREE.PerspectiveCamera(45,half/height,.1,100000);camera.position.fromArray(stats.camera.position);camera.lookAt(new THREE.Vector3().fromArray(stats.camera.target));camera.updateMatrixWorld();
  points=[];for(const dx of [-7,7])for(const dz of [-7,7])for(const y of [0,row.height]){const v=new THREE.Vector3(row.x+dx,y,row.z+dz).project(camera);points.push({x:half+(v.x+1)/2*half,y:(1-v.y)/2*height});}
  const element=[...stage.querySelectorAll('span')].find(n=>n.textContent==='24 homes · added');const r=element?.getBoundingClientRect();label=r?{x:r.x-box.x,y:r.y-box.y,right:r.right-box.x,bottom:r.bottom-box.y,text:element.textContent}:null;
 }else{
  const c=stats.camera;const x=half+half/2+(row.x-c.x)*c.zoom,y=height/2+(row.z-c.z)*c.zoom;
  points=[{x:x-7*c.zoom,y:y-7*c.zoom},{x:x+7*c.zoom,y:y+7*c.zoom}];
  const drawn=window.actualResizeLabels?.get(canvas);
  label=drawn?{x:drawn.x,y:drawn.y-drawn.ascent,right:drawn.x+Math.min(drawn.width,drawn.maxWidth),bottom:drawn.y+drawn.descent,text:drawn.text}:null;
 }
 return {month:s.month,seed:h.seed,runId:h.experimentId,modelVersion:h.modelVersion,initialHash:h.initialHash,baseline:h.baseline[s.month],plan:h.plan[s.month],metrics:s.diff.metrics,scene:stats,width,height,points,label,labelAvailableBottom:stats.backend==='canvas2d'?height-44:height,overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth};
},buildingId);}
for(const renderer of ['webgpu','canvas2d'])test(`${renderer}: focused changed building fits desktop,390,320,desktop`,async({page},info)=>{
 const errors={page:[],console:[]},records=[];page.on('pageerror',e=>errors.page.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text());});
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:info.config.metadata.sourceRoot,encoding:'utf8'}).trim();
 // Capture actual Canvas draw calls, not a copied layout formula. The native
 // function still draws and no scene, measurement or simulation value is changed.
 await page.addInitScript(()=>{
  window.actualResizeLabels=new WeakMap();
  const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){
   const result=Reflect.apply(original,this,arguments);
   if(text==='building-project-policy-1-0'){
    const metrics=this.measureText(text);
    window.actualResizeLabels.set(this.canvas,{text,x,y,maxWidth:maxWidth??Infinity,width:metrics.width,ascent:metrics.actualBoundingBoxAscent,descent:metrics.actualBoundingBoxDescent});
   }
   return result;
  };
 });
 await page.goto('/world/future-machine.html'+(renderer==='canvas2d'?'?renderer=canvas2d':''));await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 const backend=await page.evaluate(()=>window.futureMachine.stats.scene.backend);test.skip(renderer==='webgpu'&&backend!=='webgpu','Native WebGPU unavailable; no native resize claim.');expect(backend).toBe(renderer);
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('16');await slider.dispatchEvent('input');await page.getByRole('button',{name:new RegExp('^'+buildingId+' ·')}).click();
 const canvasSourceSha256=createHash('sha256').update(await (await page.request.get('/world/future-machine/scene/canvas-stage.js')).text()).digest('hex');
 const original=await measured(page);expect(original.month).toBe(16);expect(original.seed).toBe(42);expect(original.metrics.housingUnits.delta).toBe(24);
 try{
  for(const [index,width] of [1440,390,320,1440].entries()){
   await page.setViewportSize({width,height:width===1440?1000:844});const stage=page.getByTestId('future-machine-stage');await stage.scrollIntoViewIfNeeded();await page.waitForTimeout(150);
   const data=await measured(page);records.push(data);await stage.screenshot({path:info.outputPath(`${index}-${width}px.png`)});await writeFile(info.outputPath(`${index}-${width}px.json`),JSON.stringify(data,null,2));
   expect.soft(data.scene.backend).toBe(renderer);for(const key of ['month','seed','runId','modelVersion','initialHash','baseline','plan','metrics'])expect.soft(data[key]).toEqual(original[key]);expect.soft(data.scene.camera).toEqual(original.scene.camera);
   expect.soft(data.overflow,'Page must not overflow horizontally').toBe(false);
   for(const point of data.points){expect.soft(point.x,'Changed structure left edge inside plan viewport').toBeGreaterThanOrEqual(data.width/2);expect.soft(point.x,'Changed structure right edge inside plan viewport').toBeLessThanOrEqual(data.width);expect.soft(point.y).toBeGreaterThanOrEqual(0);expect.soft(point.y).toBeLessThanOrEqual(data.height);}
   expect.soft(data.label,'Selected changed-building label must be rendered').not.toBeNull();expect.soft(data.label.x).toBeGreaterThanOrEqual(data.width/2);expect.soft(data.label.right,'Selected label must fit plan viewport').toBeLessThanOrEqual(data.width);expect.soft(data.label.y).toBeGreaterThanOrEqual(0);expect.soft(data.label.bottom,'Selected label must stay above Canvas footer').toBeLessThanOrEqual(data.labelAvailableBottom);
   await slider.scrollIntoViewIfNeeded();await expect.soft(slider).toBeVisible();await expect.soft(slider).toBeEnabled();await slider.focus();await expect.soft(slider).toBeFocused();
   const why=page.getByRole('button',{name:'WHY · Homes',exact:true});await why.scrollIntoViewIfNeeded();await expect.soft(why).toBeVisible();await expect.soft(why).toBeEnabled();
  }
  if(renderer==='canvas2d'){
   const canvas=page.getByTestId('future-machine-stage').locator('canvas');await canvas.focus();
   for(let step=0;step<20;step++)await page.keyboard.press('ArrowRight');
   await page.evaluate(()=>{window.actualResizeLabels=new WeakMap();});
   await page.keyboard.press('ArrowRight');
   expect(await page.evaluate(()=>window.actualResizeLabels.has(document.querySelector('[data-testid="future-machine-stage"] canvas'))),'Off-screen building must not acquire a clamped edge label').toBe(false);
   await page.getByTestId('future-machine-stage').screenshot({path:info.outputPath('offscreen-pan-no-edge-label.png')});
  }
  expect(errors).toEqual({page:[],console:[]});
 }finally{await writeFile(info.outputPath('resize-evidence.json'),JSON.stringify({schemaVersion:'pipeline-resize.v1',sourceCommit,canvasSourceSha256,renderer,browser:page.context().browser().version(),original,records,errors,limitations:['Positions are explicitly synthetic schematic coordinates.','Canvas label bounds capture actual fillText calls and measured font ink, not a copied layout formula.']},null,2));}
});
