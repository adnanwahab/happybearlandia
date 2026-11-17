import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
test('normal route: grounded stops, keyboard, boundaries, reduced motion and mobile touch',async({page,browser},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Same worktree/server and actual route, with only the entry module restored for before evidence.
 await page.route('**/future-machine/main.js',route=>route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','HEAD:world/future-machine/main.js'],{encoding:'utf8'})}));
 await page.goto('/world/future-machine.html');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-478-before-future-machine.png',fullPage:true});
 await page.unroute('**/future-machine/main.js');await page.goto('/world/future-machine.html');
 const tour=page.getByRole('region',{name:'First Difference spotlight'});
 await expect(tour).toContainText('Spotlight unavailable');await expect(tour.getByRole('button',{name:'Next difference'})).toBeDisabled();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const next=tour.getByRole('button',{name:'Next difference'}),previous=tour.getByRole('button',{name:'Previous difference'});
 await expect(previous).toBeDisabled();await next.focus();await page.keyboard.press('Enter');await expect(tour).toContainText('Stop 1 of 3');
 const timings=[];
 for(let i=0;i<3;i++){
   const evidence=await page.evaluate(()=>{const text=document.querySelector('.fm-spotlight [role=status]').textContent;const h=window.futureMachine.history,m=window.futureMachine.state.month;return {text,month:m,events:h.plan.find(s=>s.month===m).events.map(e=>e.id)};});
   expect(evidence.events.some(id=>evidence.text.includes(`event ${id}.`))).toBe(true);expect(evidence.text).toContain(`Month ${evidence.month}`);
   if(i<2){const start=performance.now();await next.click();await expect(tour).toContainText(`Stop ${i+2} of 3`);timings.push(performance.now()-start);}
 }
 await expect(next).toBeDisabled();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(16);
 await previous.focus();await page.keyboard.press('Space');await expect(tour).toContainText('Stop 2 of 3');
 await page.emulateMedia({reducedMotion:'reduce'});await next.click();await expect(tour).toContainText('Stop 3 of 3');
 const pose=await page.evaluate(()=>window.futureMachine.stats.scene.camera);await page.waitForTimeout(1000);expect(await page.evaluate(()=>window.futureMachine.stats.scene.camera)).toEqual(pose);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-478-after-future-machine.png',fullPage:true});
 await info.attach('navigation timings (Playwright overhead included)',{body:JSON.stringify(timings),contentType:'application/json'});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});const mobile=await context.newPage();await mobile.goto('/world/future-machine.html');await mobile.getByRole('button',{name:'Fork City',exact:true}).tap();await ready(mobile);
 const mobileTour=mobile.getByRole('region',{name:'First Difference spotlight'});await mobileTour.getByRole('button',{name:'Next difference'}).tap();await expect(mobileTour).toContainText('Stop 1 of 3');
 expect(await mobileTour.getByRole('button',{name:'Next difference'}).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await mobile.screenshot({path:'.mini-symphony-evidence/SHE-478-after-future-machine-mobile.png',fullPage:true});await context.close();expect(errors).toEqual([]);
});
test('component: unavailable, zero-change, unsupported, reset and native keyboard callbacks',async({page})=>{
 await page.goto('/world/future-machine.html');
 await page.evaluate(async()=>{const {mountSpotlight}=await import('/world/future-machine/ui/spotlight.js');window.visits=[];window.spotlight=mountSpotlight(document.body,{onVisit:s=>window.visits.push(s)});});
 const tour=page.getByRole('region',{name:'First Difference spotlight'}).last();await expect(tour).toContainText('unavailable');
 for(const [status,text] of [['empty','No recorded changes'],['unsupported','no supported construction'],['unavailable','paired records']]){await page.evaluate(status=>{window.spotlight.reset({status,stops:[]});window.spotlight.update(true);},status);await expect(tour).toContainText(text);await expect(tour.getByRole('button',{name:'Next difference'})).toBeDisabled();}
 await page.evaluate(()=>window.spotlight.reset({status:'ready',stops:[{month:4,eventId:'event-fixture',entity:{arm:'plan',collection:'projects',id:'fixture'}}]}));
 await tour.getByRole('button',{name:'Next difference'}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.visits)).toHaveLength(1);
 await page.evaluate(()=>window.spotlight.reset({status:'empty',stops:[]}));await expect(tour).toContainText('No recorded changes');
});

test('inventory fallback retains grounded tour navigation when rendering contexts fail',async({page})=>{
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;if(navigator.gpu)Object.defineProperty(navigator,'gpu',{value:undefined});});
 await page.goto('/world/future-machine.html');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('inventory-fallback');
 const tour=page.getByRole('region',{name:'First Difference spotlight'});
 await tour.getByRole('button',{name:'Next difference'}).click();await expect(tour).toContainText('Stop 1 of 3');
 await tour.getByRole('button',{name:'Next difference'}).click();await tour.getByRole('button',{name:'Next difference'}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(16);await expect(tour).toContainText('building-project-policy-1-0');
});
