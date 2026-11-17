import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test('mapped sidewalk body stays visible, selectable and synchronized',async({page},info)=>{
 const errors=[],gpuErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/webgpu|GPUValidation|device.?lost|popErrorScope/i.test(m.text()))gpuErrors.push(m.text());});
 // Observe the ordinary controls; neither input nor rendering behavior is replaced.
 await page.route('**/OrbitControls.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst observedUpdate=OrbitControls.prototype.update;OrbitControls.prototype.update=function(...args){globalThis.__sidewalkControls=this;return observedUpdate.apply(this,args);};'});});
 await page.goto('/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline');
 await page.waitForFunction(()=>window.hblPersonCommands&&window.hblWorldStartup?.readyMs&&window.__sidewalkControls);
 await page.locator('[data-launch-speed="4"]').click();
 // Find a genuinely drawn walker on a lane, not an indoor access connector or
 // an individual omitted by the renderer's ordinary density budget.
 await page.evaluate(async()=>{
  const {buildPedestrianNetwork}=await import('/world/population/pedestrian-routes.js');
  const lanes=buildPedestrianNetwork(hblWorldTileSource.getFrame().roads).lanes;
  const onSidewalk=p=>lanes.some(({a,b})=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz);return t>.05&&t<.95&&Math.hypot(p.x-a[0]-dx*t,p.z-a[1]-dz*t)<.25;});
  const inside=(p,poly)=>{let v=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;};
  window.__sidewalkCandidate=()=>{
   const f=hblWorldTileSource.getFrame(),matrix=hblHumanPeople.parts[0].instanceMatrix.array;
   const p=f.people.find((p,i)=>Math.hypot(matrix[i*16],matrix[i*16+1],matrix[i*16+2])>0&&p.mode==='moving'&&p.travelMode!=='transit'&&p.tripRouteKind==='mapped-sidewalk'&&p.pathI>1&&p.pathI<p.path.length-2&&Math.hypot(p.tx-p.x,p.tz-p.z)>60&&onSidewalk(p)&&!f.buildings.some(b=>b.kind!=='park'&&b.poly&&inside(p,b.poly)));
   return p?String(p.id):null;
  };
 });
 await page.waitForFunction(()=>__sidewalkCandidate(),null,{timeout:100000});
 await page.locator('[data-launch=pause]').click();
 const id=await page.evaluate(()=>__sidewalkCandidate());
 expect(id,'natural exterior walker on a straight sidewalk segment').toBeTruthy();
 const measure=()=>page.evaluate(async id=>{
  const THREE=await import('three'),f=hblWorldTileSource.getFrame(),i=f.people.findIndex(p=>String(p.id)===id),p=f.people[i],human=hblHumanPeople,part=human.parts.find(p=>p.name==='TShirt'),m=new THREE.Matrix4();part.getMatrixAt(i,m);
  const pos=new THREE.Vector3().setFromMatrixPosition(m),camera=__sidewalkControls.object,body=new THREE.Vector3(pos.x,1.18,pos.z),ndc=body.clone().project(camera),r=document.querySelector('#view canvas').getBoundingClientRect(),x=r.left+(ndc.x+1)*r.width/2,y=r.top+(1-ndc.y)*r.height/2;
  return {id,minute:f.minute,model:[p.x,p.z],render:[pos.x,pos.z],error:Math.hypot(pos.x-p.x,pos.z-p.z),travelMode:p.travelMode,route:p.tripRouteKind,pathI:p.pathI,asset:human.assetStatus,scale:Math.hypot(m.elements[0],m.elements[1],m.elements[2]),screen:{x,y,z:ndc.z},pick:hblWorldContext.pick({clientX:x,clientY:y}),target:__sidewalkControls.target.toArray(),followError:Math.hypot(__sidewalkControls.target.x-p.x,__sidewalkControls.target.z-p.z),camera:camera.position.toArray(),seed:f.simulationSeed};
 },id);
 await writeFile(info.outputPath('pause-observation.json'),JSON.stringify(await measure(),null,2));
 await expect.poll(async()=>(await measure()).error).toBeLessThan(.001);
 // Place the real camera above this sidewalk; leave geometry, depth and LOD intact.
 await page.evaluate(id=>{const p=hblWorldTileSource.getFrame().people.find(p=>String(p.id)===id),c=__sidewalkControls;c.target.set(p.x,0,p.z);c.object.position.set(p.x,24,p.z+.1);c.update();},id);
 await expect.poll(async()=>(await measure()).pick?.id).toBe(id);
 const before=await measure();expect(before.scale).toBeGreaterThan(0);expect(before.route).toBe('mapped-sidewalk');
 await assertBodyPixels(page,before,info,'sidewalk-before');
 if(info.project.name==='mobile')await page.touchscreen.tap(before.screen.x,before.screen.y);else await page.mouse.click(before.screen.x,before.screen.y);
 await expect.poll(()=>page.evaluate(()=>hblPersonCommands.getActor()?.id)).toBe(id);
 await page.locator('#followBtn').click();
 // Speed buttons resume through the normal launch-shell handler.
 await page.locator('[data-launch-speed="1"]').click();
 await expect.poll(async()=>(await measure()).minute).toBeGreaterThan(before.minute);
 // Whole-minute observations jump by up to 40m. The ordinary exponential view
 // must converge within that minute while still running, before the pause snap.
 await expect.poll(async()=>(await measure()).error).toBeLessThan(1);
 await expect.poll(async()=>(await measure()).followError).toBeLessThan(1);
 const running=await measure();
 expect(running.screen.x).toBeGreaterThan(0);expect(running.screen.x).toBeLessThan(page.viewportSize().width);
 expect(running.screen.y).toBeGreaterThan(0);expect(running.screen.y).toBeLessThan(page.viewportSize().height);
 expect(await page.evaluate(()=>hblSimulationPlayback.getState().paused)).toBe(false);
 expect(Math.hypot(...running.render.map((n,i)=>n-before.render[i]))).toBeGreaterThan(1);
 await page.locator('[data-launch=pause]').click();
 await expect.poll(async()=>(await measure()).error).toBeLessThan(.001);
 await expect.poll(async()=>(await measure()).followError).toBeLessThan(.01);
 await page.locator('#followBtn').click();
 // Revisit the resident's new position before exercising user camera input.
 await page.evaluate(id=>{const p=hblWorldTileSource.getFrame().people.find(p=>String(p.id)===id),c=__sidewalkControls;c.target.set(p.x,0,p.z);c.object.position.set(p.x,24,p.z+.1);c.update();},id);
 const paused=await measure();
 await page.keyboard.press('Escape');
 if(info.project.name==='mobile'){
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y:550}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:267,y:550}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
 }else{await page.mouse.move(750,600);await page.mouse.wheel(0,-120);}
 await page.evaluate(()=>hblMapControls.pan('east',2));
 await expect.poll(async()=>JSON.stringify((await measure()).camera)).not.toBe(JSON.stringify(paused.camera));
 let lastCamera=(await measure()).camera;
 await expect.poll(async()=>{const camera=(await measure()).camera,delta=Math.hypot(...camera.map((n,i)=>n-lastCamera[i]));lastCamera=camera;return delta;}).toBeLessThan(.001);
 const after=await measure();expect(after.minute).toBe(paused.minute);expect(after.error).toBeLessThan(.001);
 expect(after.pick?.id).toBe(id);
 await assertBodyPixels(page,after,info,'sidewalk-after');
 await writeFile(info.outputPath('coordinates.json'),JSON.stringify({before,running,paused,after,errors,gpuErrors},null,2));
 await info.attach('coordinates',{body:JSON.stringify({before,running,paused,after,errors,gpuErrors},null,2),contentType:'application/json'});
 expect(errors).toEqual([]);expect(gpuErrors).toEqual([]);
});

// Screenshot evidence supplements the geometry/depth pick: a nonzero matrix alone
// would pass even with a body that never reached the displayed framebuffer.
async function assertBodyPixels(page,sample,info,name){
 const viewport=page.viewportSize();
 expect(sample.screen.x).toBeGreaterThan(10);expect(sample.screen.x).toBeLessThan(viewport.width-40);
 expect(sample.screen.y).toBeGreaterThan(10);expect(sample.screen.y).toBeLessThan(viewport.height-10);
 expect(sample.screen.z).toBeGreaterThan(-1);expect(sample.screen.z).toBeLessThan(1);
 const png=await page.screenshot({path:info.outputPath(`${name}.png`),scale:'css'});
 const pixels=await page.evaluate(async({image,point})=>{
  const bitmap=await createImageBitmap(await (await fetch('data:image/png;base64,'+image)).blob());
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();
  const x=Math.round(point.x),y=Math.round(point.y);
  const rgb=(x,y)=>Array.from(context.getImageData(x,y,1,1).data).slice(0,3);
  const ground=rgb(x+30,y);let bodyPixels=0;
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const c=rgb(x+dx,y+dy);if(Math.hypot(...c.map((v,k)=>v-ground[k]))>35)bodyPixels++;}
  return {bodyPixels,ground,center:rgb(x,y)};
 },{image:png.toString('base64'),point:sample.screen});
 expect(pixels.bodyPixels,'visible body pixels against adjacent sidewalk').toBeGreaterThan(20);
 await info.attach(`${name}-pixels`,{body:JSON.stringify(pixels),contentType:'application/json'});
}
