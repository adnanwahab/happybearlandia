import {test,expect} from '@playwright/test';

test('game exposes persisted volume and live reduced-motion controls without eager audio',async({page},info)=>{
 const errors=[],audio=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/game/sound.m4a'))audio.push(r.url());});
 await page.goto('/game/1');await expect(page.locator('#container canvas')).toBeVisible();
 const volume=page.getByRole('slider',{name:'Sound volume'}),motion=page.getByRole('checkbox',{name:'Reduce motion'});
 await expect(volume).toHaveValue('0');expect(audio).toEqual([]);
 await volume.fill('0.35');await volume.dispatchEvent('input');await motion.check();
 await page.reload();await expect(volume).toHaveValue('0.35');await expect(motion).toBeChecked();
 await motion.uncheck();await page.emulateMedia({reducedMotion:'reduce'});await expect(motion).toBeChecked();
 await page.screenshot({path:info.outputPath('media-settings.png')});expect(errors).toEqual([]);
});

test('recorded cinematic skips to the end and replays the same run',async({page})=>{
 await page.goto('/world/future-machine.html?demo=1');await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.demo?.status),{timeout:90000}).toBe('playing');
 const run=await page.evaluate(()=>futureMachine.history.experimentId);
 await page.getByRole('button',{name:'Skip demo',exact:true}).click();await expect.poll(()=>page.evaluate(()=>futureMachine.state.month)).toBe(120);
 await page.getByRole('button',{name:'Replay Demo',exact:true}).click();await expect.poll(()=>page.evaluate(()=>futureMachine.state.month)).toBe(0);
 expect(await page.evaluate(()=>futureMachine.history.experimentId)).toBe(run);
});
