import{test,expect}from'@playwright/test';
test('shared party scene renders twelve indistinguishable-role guests and only requests canonical movement',async({page})=>{test.setTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/party-scene-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#1c2923"><main style="width:1100px;height:760px" id="stage"></main></body>'}));await page.goto('/party-scene-fixture');await page.evaluate(async()=>{const{mountActNormalScene}=await import('/world/party/party-scene.js');window.moves=[];window.selections=[];window.fixture={phase:'round',bounds:{minX:-10,maxX:10,minZ:-8,maxZ:8},actors:Array.from({length:12},(_,i)=>({id:'guest-'+(i+1),label:'Guest '+(i+1),x:-4+(i%4)*2,z:-3+Math.floor(i/4)*2,heading:Math.PI,pose:'idle',carrying:i===0?'letter':null})),objects:[{id:'cake',kind:'cake',x:6,z:-5},{id:'letter',kind:'letter',x:6,z:0},{id:'dance-floor',kind:'dancefloor',x:6,z:5},{id:'gift-red',kind:'gift',x:0,z:-6},{id:'suitcase',kind:'suitcase',x:-6,z:0},{id:'painting',kind:'painting',x:-7,z:6},{id:'exit',kind:'exit',x:9,z:-7}]};window.view=mountActNormalScene(document.querySelector('#stage'),{onMove:p=>moves.push(p),onSelect:s=>selections.push(s)});view.update(fixture,{actorId:'guest-1'},{canMove:true,isConnected:true});await view.ready;});expect((await page.evaluate(()=>view.getDebug())).actorIds).toHaveLength(12);expect((await page.evaluate(()=>view.getDebug())).humanRoleLabels).toBe(0);const target=await page.evaluate(()=>view.project(6,-5,1));await page.mouse.click(target.x,target.y);expect(await page.evaluate(()=>selections.at(-1).record.id)).toBe('cake');const before=await page.evaluate(()=>view.getDebug().actors[0].position);await page.keyboard.press('w');await expect.poll(()=>page.evaluate(()=>moves.length)).toBeGreaterThan(0);await page.waitForTimeout(150);expect((await page.evaluate(()=>view.getDebug().actors[0].position))).toEqual(before);await page.evaluate(()=>{fixture.actors[0].x+=1;fixture.actors[1].x+=1;view.update(fixture,{actorId:'guest-1'},{canMove:true,isConnected:true});});await expect.poll(()=>page.evaluate(()=>view.getDebug().actors[0].position.x)).toBeGreaterThan(before.x+.9);await page.screenshot({path:'/private/tmp/hbl-act-normal-party-scene.png'});await page.evaluate(()=>view.update(fixture,{actorId:'guest-1'},{canMove:false,isConnected:false}));const n=await page.evaluate(()=>moves.length);await page.keyboard.press('d');expect(await page.evaluate(()=>moves.length)).toBe(n);expect(errors).toEqual([]);await page.evaluate(()=>view.destroy());});
test('party lobby is responsive and explains actual online/private play',async({page})=>{await page.goto('/world/party/act-normal.html');await expect(page.getByRole('heading',{name:'Everybody act normal.'})).toBeVisible();await expect(page.getByRole('button',{name:'Create a party'})).toBeVisible();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Create a party'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/private/tmp/hbl-act-normal-lobby-mobile.png',fullPage:true});});

test('round updates wait for renderer initialization and render the latest snapshot', async ({ page }) => {
  await page.route('**/party-init-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<main id="stage" style="width:800px;height:560px"></main>',
  }));
  await page.goto('/party-init-fixture');
  const state = await page.evaluate(async () => {
    const THREE = await import('/vendor/three/three.webgpu.js');
    const { mountActNormalScene } = await import('/world/party/party-scene.js');
    const original = THREE.WebGPURenderer.prototype.init;
    let markStarted;
    let release;
    const started = new Promise(resolve => { markStarted = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    THREE.WebGPURenderer.prototype.init = async function (...args) {
      markStarted();
      await gate;
      return original.apply(this, args);
    };
    const scene = mountActNormalScene(document.querySelector('#stage'));
    try {
      await Promise.race([started, scene.ready.then(() => { throw new Error('WebGPU initialization did not begin'); })]);
      const snapshot = { actors: [{ id: 'guest-1', x: 0, z: 0 }], objects: [] };
      scene.update(snapshot, { actorId: 'guest-1' }, { canMove: true });
      scene.update({ ...snapshot, actors: [{ id: 'guest-2', x: 2, z: 3 }] }, { actorId: 'guest-2' }, { canMove: true });
      release();
      if (!await scene.ready) throw new Error('WebGPU renderer did not become ready');
      return scene.getDebug().actors.map(({ id, position }) => ({ id, position }));
    } finally {
      release();
      await scene.ready;
      scene.destroy();
      THREE.WebGPURenderer.prototype.init = original;
    }
  });
  expect(state).toEqual([{ id: 'guest-2', position: { x: 2, z: 3 } }]);
});
