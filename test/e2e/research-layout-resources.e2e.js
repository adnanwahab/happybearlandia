import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

const selectedId='building-project-policy-1-0';
for(const renderer of ['webgl','canvas'])test(`${renderer}: focused resize retains actual run and repeated scrubs release resources`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`/world/future-machine.html?renderer=${renderer}`);
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 const seek=async month=>{const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');};
 await seek(16);await page.getByRole('button',{name:new RegExp(selectedId+' · schematic')}).last().click();
 const initial=await page.evaluate(()=>({run:window.futureMachine.history.experimentId,seed:window.futureMachine.history.seed,hash:window.futureMachine.history.initialHash,metrics:window.futureMachine.state.diff.metrics,camera:window.futureMachine.stats.scene.camera}));
 const resizes=[];
 for(const width of [1440,390,320,1440]){
  await page.setViewportSize({width,height:width<500?844:1000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const measured=await page.evaluate(({selectedId})=>{
   const api=window.futureMachine,canvas=document.querySelector('.fm-stage canvas'),box=canvas.getBoundingClientRect();
   const stats=api.stats.scene;
   const center=stats.targets.find(row=>row.id===selectedId&&row.arm==='plan')??{x:box.width*.75,y:box.height*.5};
   let canvasCenter=null;
   if(stats.backend==='canvas2d'){
    const pixel=canvas.getContext('2d').getImageData(Math.floor(canvas.width*.75),Math.floor(canvas.height*.5),1,1).data;
    canvasCenter=[...pixel];
   }
   return {viewport:innerWidth,backend:stats.backend,camera:stats.camera,selected:stats.selected,month:api.state.month,metrics:api.state.diff.metrics,run:api.history.experimentId,seed:api.history.seed,hash:api.history.initialHash,center,canvasCenter,bounds:{width:box.width,height:box.height},overflow:document.documentElement.scrollWidth>innerWidth,objects:stats.objects};
  },{selectedId});
  expect(measured.backend).toBe(renderer==='canvas'?'canvas2d':'webgl');
  expect(measured.camera).toEqual(initial.camera);expect(measured.month).toBe(16);expect(measured.metrics).toEqual(initial.metrics);
  expect(measured.run).toBe(initial.run);expect(measured.seed).toBe(initial.seed);expect(measured.hash).toBe(initial.hash);
  expect(measured.overflow).toBe(false);
  expect(measured.center.x).toBeGreaterThan(measured.bounds.width/2+3);expect(measured.center.x).toBeLessThan(measured.bounds.width-3);
  expect(measured.center.y).toBeGreaterThan(3);expect(measured.center.y).toBeLessThan(measured.bounds.height-3);
  if(measured.canvasCenter){expect(measured.selected).toEqual({collection:'buildings',id:selectedId});expect(Math.max(...measured.canvasCenter.slice(0,3))).toBeGreaterThan(90);}
  if(width<500){await page.getByTestId('future-machine-stage').screenshot({path:info.outputPath(`${renderer}-focused-${width}.png`)});}
  resizes.push(measured);
 }
 const resources=await page.evaluate(async()=>{
  const api=window.futureMachine,slider=document.querySelector('[data-testid="future-machine-timeline"]'),samples=[];
  for(let repeat=0;repeat<8;repeat++)for(const month of [0,15,16,120]){
   slider.value=String(month);slider.dispatchEvent(new Event('input'));
   if(month>=16){
    const selected=[...document.querySelectorAll('.fm-stage button')].find(button=>button.textContent.startsWith('building-project-policy-1-0 ·'));
    if(!selected)throw new Error('Recorded focus control missing');selected.click();
   }
   const stats=api.stats.scene;samples.push({repeat,month,objects:stats.objects,geometries:stats.geometries,textures:stats.textures,canvases:document.querySelectorAll('.fm-stage canvas').length});
  }
  const history=api.history,frame=api.state.frame,diff=api.state.diff;
  api.dispose();const after=api.stats.scene,remainingCanvases=document.querySelectorAll('.fm-stage canvas').length;
  const {createStage}=await import('/world/future-machine/scene/index.js');const cycles=[];
  for(let repeat=0;repeat<3;repeat++){
   const host=document.createElement('div');host.style.width='800px';document.body.append(host);
   const stage=createStage(host,{history});stage.update(frame,diff);await stage.whenReady();stage.focus({collection:'buildings',id:'building-project-policy-1-0'});
   const mounted=stage.getStats();stage.dispose();cycles.push({mounted,disposed:stage.getStats(),canvases:host.querySelectorAll('canvas').length});host.remove();
  }
  return {samples,after,remainingCanvases,cycles};
 });
 expect(resources.samples.every(row=>row.objects<=10&&row.canvases===1)).toBe(true);
 if(renderer==='webgl'){
  for(const month of [0,15,16,120])expect(new Set(resources.samples.filter(row=>row.month===month).map(row=>row.geometries)).size).toBe(1);
 }
 expect(resources.after.objects).toBe(0);expect(resources.remainingCanvases).toBe(0);expect(errors).toEqual([]);
 for(const cycle of resources.cycles){expect(cycle.mounted.objects).toBeGreaterThan(0);expect(cycle.mounted.objects).toBeLessThanOrEqual(10);expect(cycle.disposed.objects).toBe(0);expect(cycle.canvases).toBe(0);}
 await writeFile(info.outputPath(`${renderer}-resize-resources.json`),JSON.stringify({schemaVersion:'research-layout-resources.v1',initial,resizes,resources,errors},null,2));
});
