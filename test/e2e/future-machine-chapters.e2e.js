import {test,expect} from '@playwright/test';
test('normal entry chapters seek exact month and open WHY with keyboard and touch',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 const region=page.getByRole('region',{name:'Recorded event chapters'}),tick=region.getByRole('button',{name:/PROJECT_COMPLETE/}).first();
 await expect(tick).toBeVisible();await tick.focus();await page.keyboard.press('Enter');
 const month=Number((await tick.textContent()).match(/Month (\d+)/)[1]);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');
 await region.getByRole('button').first().focus();await page.keyboard.press('End');await expect(region.getByRole('button').last()).toBeFocused();await page.keyboard.press('Home');await expect(region.getByRole('button').first()).toBeFocused();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-479-after-timeline-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await tick.click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-479-after-timeline-mobile.png',fullPage:true});
});
test('component empty/unavailable, touch, reduced motion and measured build cost',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
 await page.goto('/world/future-machine.html');
 const measurement=await page.evaluate(async()=>{
 const {createChapters,buildChapters}=await import('/world/future-machine/ui/chapters.js');
 document.body.replaceChildren();window.jumps=[];
 const history={baseline:[{month:16,events:[{id:'e1',eventType:'PROJECT_COMPLETE',simulationTime:16}]}],plan:[]};
 window.view=createChapters(document.body,{history,onJump:chapter=>window.jumps.push(chapter.month)});
 const start=performance.now();for(let i=0;i<1000;i++)buildChapters(history);return {iterations:1000,milliseconds:performance.now()-start};
 });console.log('chapter build benchmark',JSON.stringify(measurement));
 await page.getByRole('button').tap();expect(await page.evaluate(()=>jumps)).toEqual([16]);
 await page.evaluate(async()=>{view.dispose();const {createChapters}=await import('/world/future-machine/ui/chapters.js');createChapters(document.body,{history:{baseline:[],plan:[]}});createChapters(document.body,{});});
 await expect(page.getByText('No recorded events in supplied history. No discoveries inferred.')).toBeVisible();await expect(page.getByText('Chapter history unavailable.')).toBeVisible();expect(await page.getByRole('button').count()).toBe(0);await context.close();
});
