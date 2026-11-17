import {test,expect} from '@playwright/test';
for(const mobile of [false,true]) test(`minimap bookmarks preserve scene and selection ${mobile?'mobile reduced motion':'desktop'}`,async({page})=>{
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  if(mobile)await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/OrbitControls.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst original=OrbitControls.prototype.update;OrbitControls.prototype.update=function(...args){globalThis.__camera=this;return original.apply(this,args);};'});});
  await page.goto('/world?demo=1&synthetic=1&people=16&renderer=webgl&quality=LOW');
  await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.__camera);
  const map=page.getByTestId('world-minimap');await map.locator('summary').click();
  await map.getByRole('button',{name:'Center loaded area',exact:true}).click();
  const target=()=>page.evaluate(()=>({x:__camera.target.x,z:__camera.target.z}));
  const saved=await target();

  const distance=()=>page.evaluate(()=>__camera.object.position.distanceTo(__camera.target));
  const originalDistance=await distance();
  await map.locator('canvas').focus();await page.keyboard.press('+');
  expect(await distance()).toBeLessThan(originalDistance);
  await page.keyboard.press('-');expect(await distance()).toBeCloseTo(originalDistance,2);
  const pocket=await map.boundingBox();
  await map.getByRole('button',{name:'Expand map',exact:true}).click();
  await expect(map).toHaveClass(/mm-expanded/);
  expect(await target()).toEqual(saved);
  await expect(map.getByRole('button',{name:'Collapse map',exact:true})).toHaveAttribute('aria-expanded','true');
  await page.screenshot({path:test.info().outputPath(`overview-${mobile?'mobile':'desktop'}.png`)});
  if(mobile) {
    expect(await map.evaluate(el=>el.getAnimations().length)).toBe(0);
    const box=await map.locator('canvas').boundingBox(), session=await page.context().newCDPSession(page);
    const beforePinch=await distance(), x=box.x+box.width/2,y=box.y+box.height/2;
    const points=d=>[{x:x-d,y,id:1},{x:x+d,y,id:2}];
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(20)});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(30)});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(45)});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await distance()).toBeLessThan(beforePinch);
    expect(await target()).toEqual(saved);
    await session.detach();
  }
  await page.keyboard.press('Escape');
  await expect(map).not.toHaveClass(/mm-expanded/);
  expect(await target()).toEqual(saved);
  await expect(map.getByRole('button',{name:'Expand map',exact:true})).toBeFocused();
  await expect.poll(async()=>Math.round((await map.boundingBox()).width)).toBe(Math.round(pocket.width));
  const parcel=map.getByLabel('Select loaded parcel');
  const option=await parcel.locator('option').nth(1).getAttribute('value');
  await parcel.selectOption(option);
  const selectedInspector=await page.locator('#inspect').textContent();
  await map.getByRole('button',{name:'Expand map',exact:true}).click();
  await expect.poll(()=>page.locator('#inspect').textContent()).toBe(selectedInspector);
  await map.getByRole('button',{name:'Collapse map',exact:true}).click();
  expect(await page.locator('#inspect').textContent()).toBe(selectedInspector);

  await map.getByRole('button',{name:'Bookmark view',exact:true}).click();
  const bookmark=map.locator('[data-mm-bookmarks] button');await expect(bookmark).toHaveCount(1);
  await map.locator('canvas').focus();await page.keyboard.press('ArrowRight');
  await expect.poll(async()=>JSON.stringify(await target())).not.toBe(JSON.stringify(saved));
  // Existing activity selection entry point uses a persistent person ID.
  const id=await page.evaluate(()=>window.hblWorldActivity.getSnapshot?.()?.people?.[0]?.id??null);
  expect(id).not.toBeNull();
  await page.evaluate(id=>window.hblWorldActivity.selectPerson(id),id);
  await expect(map.locator('[data-mm-recent] button')).toHaveCount(1);
  const inspector=await page.locator('#inspect').textContent();
  await map.locator('[data-mm-recent] button').click();
  expect(await page.locator('#inspect').textContent()).toBe(inspector);
  const marker=await page.evaluate(()=>{window.__sceneMarker={};return performance.timeOrigin;});
  await bookmark.focus();await page.keyboard.press('Enter');
  await expect.poll(async()=>JSON.stringify(await target())).toBe(JSON.stringify(saved));
  expect(await page.locator('#inspect').textContent()).toBe(inspector);
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(marker);
  expect(await page.evaluate(()=>Boolean(window.__sceneMarker))).toBe(true);
  await page.screenshot({path:test.info().outputPath(`minimap-${mobile?'mobile':'desktop'}.png`)});
  await page.keyboard.press('Escape');await expect(map).not.toHaveAttribute('open','');await expect(map.locator('summary')).toBeFocused();
  await page.keyboard.press('Enter');await expect(bookmark).toBeVisible();
  await map.getByRole('button',{name:'Hide map',exact:true}).click();await expect(map.locator('summary')).toBeFocused();
  expect(errors).toEqual([]);
});

for(const capability of ['missing-animation','missing-bounds']) test(`overview immediate fallback ${capability}`,async({page})=>{
 await page.goto('/');
 await page.evaluate(async capability=>{
  const THREE=await import('/vendor/three/three.module.js');
  const {mountMinimap}=await import('/world/minimap.js');
  if(capability==='missing-animation') Element.prototype.animate=undefined;
  const controls={target:new THREE.Vector3(),update(){},addEventListener(){},removeEventListener(){}};
  const camera=new THREE.PerspectiveCamera();camera.position.set(50,100,50);
  window.__fallback=mountMinimap(document.body,{THREE,camera,controls,...(capability==='missing-bounds'?{}:{bounds:{minX:0,maxX:100,minZ:0,maxZ:100}})});
 },capability);
 const map=page.getByTestId('world-minimap'); await map.locator('summary').click();
 await map.getByRole('button',{name:'Expand map',exact:true}).click();
 await expect(map).toHaveClass(/mm-expanded/);
 expect(await map.evaluate(el=>el.getAnimations().length)).toBe(0);
 if(capability==='missing-bounds') await expect(map.locator('canvas')).toHaveAttribute('aria-disabled','true');
 await page.keyboard.press('Escape');await expect(map).not.toHaveClass(/mm-expanded/);
});
