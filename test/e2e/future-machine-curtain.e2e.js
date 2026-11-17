import {test,expect} from '@playwright/test';
for(const renderer of ['canvas2d','webgl'])test(`${renderer}: aligned curtain pointer, keyboard, clock and reduced motion`,async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`/world/future-machine.html?renderer=${renderer}`);
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe(renderer);
 const toggle=page.getByRole('button',{name:'Aligned curtain',exact:true});await expect(toggle).toBeEnabled();
 await page.screenshot({path:`.mini-symphony-evidence/SHE-475-curtain-before-${renderer}.png`,fullPage:true});
 await toggle.click();const slider=page.getByRole('slider',{name:'Before/after curtain position'});
 await expect(slider).toBeVisible();await slider.focus();await page.keyboard.press('ArrowRight');await expect(slider).toHaveValue('51');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.curtainPosition)).toBe(.51);
 const canvas=page.getByRole('region',{name:'Synchronized City comparison'}).locator('canvas');const box=await canvas.boundingBox();
 const before=await page.evaluate(()=>({camera:window.futureMachine.stats.scene.camera,month:window.futureMachine.state.month,seed:window.futureMachine.state.recipe.seed}));
 await page.mouse.move(box.x+box.width*.51,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.5,{steps:12});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.curtainPosition)).toBeCloseTo(.75,1);
 const after=await page.evaluate(()=>({camera:window.futureMachine.stats.scene.camera,month:window.futureMachine.state.month,seed:window.futureMachine.state.recipe.seed}));expect(after).toEqual(before);
 await expect(page.getByText(/WITHOUT PLAN ←.*seed 42/)).toBeVisible();
 const samples=await slider.evaluate(async input=>{const values=[];for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const t=performance.now();input.value=String(i%100);input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);values.push(performance.now()-t);}return values;});
 await testInfo.attach('curtain-frame-opportunity-ms.json',{body:JSON.stringify({renderer,samples,note:'Emulated Chromium frame opportunity latency, not physical-device certification.'}),contentType:'application/json'});
 await page.screenshot({path:`.mini-symphony-evidence/SHE-475-curtain-after-${renderer}.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});await canvas.scrollIntoViewIfNeeded();
 const mobileBox=await canvas.boundingBox(),position=await page.evaluate(()=>window.futureMachine.stats.scene.curtainPosition);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileBox.x+mobileBox.width*position,y:mobileBox.y+mobileBox.height*.5}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mobileBox.x+mobileBox.width*.8,y:mobileBox.y+mobileBox.height*.5}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.curtainPosition)).toBeCloseTo(.8,1);
 await page.screenshot({path:`.mini-symphony-evidence/SHE-475-curtain-after-mobile-${renderer}.png`,fullPage:true});

 await page.getByRole('button',{name:'Side by side',exact:true}).click();await page.getByRole('button',{name:'Blink: Future A',exact:true}).click();await expect(toggle).toBeDisabled();await expect(slider).toBeHidden();
});

test('empty checkpoints and unsupported geometry expose explicit disabled curtain',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.evaluate(async()=>{
  const {createStage}=await import('/world/future-machine/scene/index.js');
  const host=document.createElement('div');host.id='curtain-failure-fixture';document.body.append(host);
  const stage=createStage(host);await stage.whenReady();
  stage.update(null,null);window.curtainFixture=stage;
 });
 const fixture=page.locator('#curtain-failure-fixture');await expect(fixture.getByRole('button',{name:'Aligned curtain'})).toBeDisabled();
 await expect(fixture.getByText(/Curtain unavailable: Both checkpoint/)).toBeVisible();
 await page.evaluate(()=>{const snapshot={month:0,state:{month:0,seed:42,buildings:[{id:'a',geometry:{type:'MultiPolygon',coordinates:[]}}],projects:[]}};window.curtainFixture.update({month:0,baseline:snapshot,plan:structuredClone(snapshot)},{entities:[]});});
 await expect(fixture.getByRole('button',{name:'Aligned curtain'})).toBeDisabled();await expect(fixture.getByText(/Curtain unavailable: Unsupported/)).toBeVisible();
 await page.evaluate(()=>{window.curtainFixture.dispose();delete window.curtainFixture;});
});
