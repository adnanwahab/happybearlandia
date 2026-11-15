import { test, expect } from '@playwright/test';

const route='/world?demo=1&people=30&quality=LOW';

test('normal World entry exposes resident inspection, pause, speed and event history', async ({page}, info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(route,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#launch-navigation')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs)),{timeout:60000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.hblWorldActivity?.getSnapshot()?.people?.length??0)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.hblCityRenderer.getPerformanceStats().backend)).toBe('webgpu');
  await page.locator('[data-launch="people"]').click();
  await expect(page.locator('#launch-panel')).toBeVisible();
  await page.locator('.launch-person-list button').first().click();
  await expect(page.locator('#inspect')).toBeVisible();
  await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>window.hblSimulationPlayback.getState().paused)).toBe(true);
  const minute=await page.evaluate(()=>window.hblWorldActivity.getSnapshot().minute);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.hblWorldActivity.getSnapshot().minute)).toBe(minute);
  await page.keyboard.press('2');
  await expect.poll(()=>page.evaluate(()=>window.hblSimulationPlayback.getState().speed)).toBe(2);
  await expect.poll(()=>page.evaluate(()=>window.hblSimulationPlayback.getState().paused)).toBe(false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox',{name:'Search world actions'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#launch-panel')).toBeHidden();
  await page.locator('[data-launch="legends"]').click();
  await expect(page.locator('#launch-panel')).toContainText('retained');
  await page.keyboard.press('Escape');
  await page.screenshot({path:'artifacts/she-789/after-desktop.png'});
  await info.attach('uncaught-errors',{body:JSON.stringify(errors),contentType:'application/json'});
  expect(errors).toEqual([]);
});

for(const width of [390,768])test(`World navigation remains in bounds at ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:844});
  await page.goto(route,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#launch-navigation')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs)),{timeout:60000}).toBe(true);
  await page.locator('[data-launch="people"]').click();
  await expect(page.locator('#launch-panel')).toBeVisible();
  for(const id of ['launch-navigation','launch-panel','launch-playback']){
    const box=await page.locator('#'+id).boundingBox();
    expect(box.x,id).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width,id).toBeLessThanOrEqual(width+1);
  }
  await page.keyboard.press('Escape');
  await page.screenshot({path:`artifacts/she-789/after-${width}.png`});
  expect(errors).toEqual([]);
});

test('scene context menu precedes build gesture and creates a location-specific draft',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(route,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldContext&&window.hblPersonCommands)),{timeout:60000}).toBe(true);
 await page.locator('[data-launch=people]').click();
 await page.locator('.launch-person-list button').first().click();
 const ground=await page.evaluate(()=>{const source=window.hblWorldTileSource.getFrame(),points=source.buildings.flatMap(b=>b.poly||[]),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);for(let y=300;y<780;y+=30)for(let x=240;x<960;x+=30){const hit=window.hblWorldContext.pick({clientX:x,clientY:y});if(hit?.kind==='ground'&&hit.point.x>Math.min(...xs)&&hit.point.x<Math.max(...xs)&&hit.point.z>Math.min(...zs)&&hit.point.z<Math.max(...zs))return{x,y};}return null;});
 expect(ground,'a visible buildable ground candidate').not.toBeNull();
 await page.mouse.click(ground.x,ground.y,{button:'right'});
 const menu=page.getByRole('dialog',{name:'World object actions'});
 await expect(menu).toBeVisible();
 await expect(menu.getByRole('button',{name:'Walk here',exact:true})).toBeVisible();
 const actorId=await page.evaluate(()=>window.hblPersonCommands.getActor().id);
 await menu.getByRole('button',{name:'Walk here',exact:true}).click();
 await expect(menu).toBeHidden();
 expect(await page.evaluate(()=>window.hblPersonCommands.getActor()?.id)).toBe(actorId);
 expect(await page.evaluate(id=>window.hblWorldTileSource.getFrame().people.find(p=>String(p.id)===id)?.mode,actorId)).toBe('moving');
 await page.mouse.click(ground.x,ground.y,{button:'right'});
 await menu.getByRole('button',{name:'Build here',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'What should go here?'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('textbox',{name:'What should go here?'})).toBeHidden();
 expect(errors).toEqual([]);
});

test('consented World session captures real camera and time and returns to logs',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/logs');
 await page.getByRole('checkbox').check();
 await page.goto(route,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblSessionLogState&&window.hblSessionRecorder)),{timeout:60000}).toBe(true);
 await page.locator('[data-launch=time]').click();
 await page.waitForTimeout(1400);
 await page.evaluate(()=>window.hblSessionRecorder.flush());
 const sessions=await page.evaluate(()=>JSON.parse(localStorage.getItem('hbl.play-sessions.v1')||'[]'));
 expect(sessions.length).toBeGreaterThan(0);
 expect(sessions.at(-1).events.some(e=>e.type==='sample'&&e.camera?.length===3&&Number.isFinite(e.minute))).toBe(true);
 await page.goto('/logs');
 await page.locator('#sessions button').first().click();
 await expect(page.locator('#player')).toBeVisible();
 await page.getByRole('checkbox').uncheck();
 await expect(page.locator('#sessions')).toContainText('No sessions saved');
 expect(errors).toEqual([]);
});


test('WebGPU unavailable opens a rendering-only WebGL2 city without simulation',async({page})=>{
 const errors=[],requests=[];let workers=0;page.on('pageerror',e=>errors.push(e.message));page.on('worker',()=>workers++);page.on('request',r=>requests.push(new URL(r.url()).pathname));
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,get:()=>undefined}));
 await page.goto('/world?demo=1&people=30',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/\/world\/static-city\.html/);
 await expect.poll(()=>page.evaluate(()=>window.hblStaticCity?.getState().ready),{timeout:30000}).toBe(true);
 expect(await page.evaluate(()=>window.hblStaticCity.getState())).toMatchObject({backend:'webgl2',viewOnly:true,people:0,workers:0,simulation:false});
 expect(await page.evaluate(()=>[typeof window.hblWorldActivity,typeof window.hblSimulationPlayback,typeof window.hblLivingWorld])).toEqual(['undefined','undefined','undefined']);
 expect(workers).toBe(0);expect(requests.filter(path=>/\/(sim\.js|population\/|render\.js|simulation-playback\.js)/.test(path))).toEqual([]);expect(errors).toEqual([]);
});

test('Living resident Follow remains enabled when the context action repeats it',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(route,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblLivingWorld)),{timeout:60000}).toBe(true);
 await page.locator('[data-launch=tools]').click();
 await page.getByTestId('living-city-toggle').click();
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.active),{timeout:60000}).toBe(true);
 await page.locator('[data-launch=people]').click();
 await page.locator('.launch-person-list button').first().click();
 const follow=page.locator('[data-lc-follow]');await follow.click();
 await expect(follow).toHaveAttribute('aria-pressed','true');
 // Isolate repeated-action semantics with the actual selected model identity.
 // Full ground/building geometry picking is exercised by the draft test above.
 await page.evaluate(()=>{const person=window.hblLivingWorld.getSelection();window.hblWorldContext.pick=()=>({kind:'person',id:String(person.id??person.personId),point:{x:person.x,z:person.z}});});
 await page.mouse.click(700,600,{button:'right'});
 await page.getByRole('dialog',{name:'World object actions'}).getByRole('button',{name:'Follow',exact:true}).click();
 await expect(follow).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});

test('right-button camera drag does not open object actions or perform context picking',async({page})=>{
 await page.goto(route,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldContext)),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{window.__contextPicks=0;const original=window.hblWorldContext.pick;window.hblWorldContext.pick=event=>{window.__contextPicks++;return original(event);};});
 await page.mouse.move(600,450);await page.mouse.down({button:'right'});await page.mouse.move(660,470,{steps:10});await page.mouse.up({button:'right'});
 await expect(page.getByRole('dialog',{name:'World object actions'})).toBeHidden();
 expect(await page.evaluate(()=>window.__contextPicks)).toBe(0);
});
