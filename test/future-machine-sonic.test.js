import {test,expect} from 'bun:test';
import {deltaCue,createCuePlayer} from '../world/future-machine/ui/sonic.js';
const metric={baseline:36,plan:60,delta:24,unit:'homes'};
test('recorded deltas map deterministically without mutation or invented availability',()=>{
 const before=JSON.stringify(metric),cue=deltaCue('housingUnits',metric);
 expect(cue).toEqual(deltaCue('housingUnits',structuredClone(metric)));expect(cue.duration).toBe(.32);expect(cue.caption).toContain('rising');expect(JSON.stringify(metric)).toBe(before);
 expect(deltaCue('housingUnits',{baseline:60,plan:36,delta:-24}).caption).toContain('falling');
 for(const value of [null,{}, {...metric,available:false},{...metric,delta:NaN},{...metric,delta:3}])expect(deltaCue('housingUnits',value)).toBeNull();
 expect(deltaCue('unknown',metric)).toBeNull();expect(deltaCue('housingUnits',{baseline:0,plan:0,delta:0}).silent).toBe(true);
 expect(deltaCue('housingUnits',{baseline:0,plan:1e12,delta:1e12}).duration).toBe(.32);
});
function audio(){const events=[];const param={setValueAtTime:v=>events.push(v),linearRampToValueAtTime:v=>events.push(v)};return {events,state:'running',currentTime:0,destination:{},resume:async()=>{},createOscillator:()=>({frequency:param,connect(){},disconnect(){events.push('disconnect');},start(){events.push('start');},stop(){events.push('stop');}}),createGain:()=>({gain:param,connect(){},disconnect(){}}),close:async()=>{events.push('close');}};}
test('mute, failures, rapid requests and disposal suppress stale voices and cap gain',async()=>{
 const ctx=audio();let created=0;const player=createCuePlayer({createContext:()=>{created++;return ctx;}}),cue=deltaCue('housingUnits',metric);
 expect(await player.play(cue,0)).toBe(false);expect(created).toBe(0);
 const pending=player.play(cue,1);player.stop();expect(await pending).toBe(false);expect(ctx.events).not.toContain('start');
 expect(await player.play(cue,5)).toBe(true);expect(ctx.events).toContain(.035);
 player.dispose();expect(ctx.events).toContain('stop');expect(ctx.events).toContain('close');expect(await player.play(cue,1)).toBe(false);
 const broken=createCuePlayer({createContext:()=>{throw Error('unsupported');}});expect(await broken.play(cue,1)).toBe(false);broken.dispose();
});
test.skipIf(!process.env.HBL_FM_BROWSER)('mobile and keyboard controls, navigation silence, fallback and teardown',async()=>{
 const {chromium}=await import(process.env.HBL_PLAYWRIGHT_MODULE||'@playwright/test');
 const root=new URL('../',import.meta.url).pathname;
 const server=Bun.serve({port:0,fetch(req){const path=new URL(req.url).pathname;return path==='/'?new Response('<meta name="viewport" content="width=device-width,initial-scale=1"><body><section class="fm-ui"><div class="fm-metrics"></div></section>',{headers:{'content-type':'text/html'}}):new Response(Bun.file(root+path));}});
 let browser;
 try{browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(`http://localhost:${server.port}`);
 await page.evaluate(async()=>{const {mountSonicControls}=await import('/world/future-machine/ui/sonic.js');window.sonic=mountSonicControls(document.querySelector('section'));window.state={status:'ready',diff:{available:true,metrics:{housingUnits:{baseline:36,plan:60,delta:24,unit:'homes'}}}};window.sonic.update(window.state);});
 const play=page.getByRole('button',{name:'Hear selected difference'});expect(await play.isDisabled()).toBe(true);
 const volume=page.getByRole('slider',{name:'Sound volume'});await volume.focus();await page.keyboard.press('ArrowRight');expect(await play.isEnabled()).toBe(true);
 await play.focus();await page.keyboard.press('Enter');await page.waitForTimeout(400);
 expect(await page.getByRole('status').textContent()).toContain('Synthetic model difference');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-508-sonic-after-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.mini-symphony-evidence/SHE-508-sonic-after-desktop.png'});
 await page.evaluate(()=>{for(let month=0;month<120;month++)window.sonic.update({...window.state,month,camera:{x:month}});window.sonic.update({...window.state,status:'error'});});expect(await play.isDisabled()).toBe(true);expect(await page.getByRole('status').textContent()).toContain('silent');
 await page.evaluate(()=>{window.sonic.update({status:'ready',diff:{available:false}});window.sonic.dispose();});expect(await page.getByRole('button').count()).toBe(0);
 }finally{await browser?.close();server.stop(true);}
});
