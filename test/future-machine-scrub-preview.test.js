import {test,expect} from 'bun:test';
import {checkpointPreview,bindScrubPreview} from '../world/future-machine/ui/scrub-preview.js';
const history={seed:42,modelVersion:'fixture',experimentId:'disposable',baseline:[{month:0,metrics:{housingUnits:0}}],plan:[{month:0,metrics:{housingUnits:24}}]};
test('exact paired checkpoint, no neighboring substitution or missing-as-zero',()=>{
 expect(checkpointPreview(history,0)).toContain('WITHOUT PLAN 0 homes');
 expect(checkpointPreview(history,0)).toContain('WITH PLAN 24 homes');
 expect(checkpointPreview(history,1)).toContain('Unavailable');
 expect(checkpointPreview(history,1,true)).toContain('Loading');
 expect(checkpointPreview({...history,plan:[{month:1}]},0)).toContain('Unavailable');
 expect(checkpointPreview({...history,plan:[{month:0}]},0)).toContain('WITH PLAN Unavailable');
});
test('drag is isolated, release debounces, cancel and disposal discard pending selection',async()=>{
 const slider=new EventTarget();slider.value=0;slider.setAttribute=()=>{};
 const card={hidden:true};const commits=[];const state={ready:true,history,month:0};
 const binding=bindScrubPreview(slider,card,{getState:()=>state,onCommit:m=>commits.push(m),delay:5});
 slider.dispatchEvent(new Event('pointerdown'));
 for(let i=0;i<120;i++){slider.value=i;slider.dispatchEvent(new Event('input'));}
 binding.update();expect(slider.value).toBe(119);expect(commits).toEqual([]);
 slider.dispatchEvent(new Event('change'));await Bun.sleep(10);expect(commits).toEqual([]);
 slider.dispatchEvent(new Event('pointerup'));slider.dispatchEvent(new Event('change'));
 await Bun.sleep(15);expect(commits).toEqual([119]);
 slider.value=4;slider.dispatchEvent(new Event('input'));slider.dispatchEvent(new Event('pointercancel'));slider.dispatchEvent(new Event('change'));
 await Bun.sleep(10);expect(commits).toEqual([119]);
 slider.dispatchEvent(new Event('input'));slider.dispatchEvent(new Event('change'));binding.dispose();await Bun.sleep(10);expect(commits).toEqual([119]);
});
test.skipIf(!process.env.HBL_FM_BROWSER)('browser native keyboard, touch release, unavailable preview and bounded burst',async()=>{
 const {chromium}=await import('@playwright/test');
 const root=new URL('../',import.meta.url).pathname;
 const server=Bun.serve({port:0,fetch(req){const path=new URL(req.url).pathname;return path==='/'?new Response('<!doctype html><body><input type="range" min="0" max="120" value="0"><aside hidden role="status"></aside></body>',{headers:{'content-type':'text/html'}}):new Response(Bun.file(root+path));}});
 let browser;
 try{browser=await chromium.launch({headless:true});const page=await browser.newPage({hasTouch:true,viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(`http://localhost:${server.port}`);
 await page.evaluate(async history=>{const {bindScrubPreview}=await import('/world/future-machine/ui/scrub-preview.js');window.commits=[];window.binding=bindScrubPreview(document.querySelector('input'),document.querySelector('aside'),{getState:()=>({history,ready:true,month:0}),onCommit:m=>commits.push(m)});},history);
 const slider=page.locator('input');await slider.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);expect(await page.evaluate(()=>commits)).toEqual([1]);
 await page.evaluate(()=>{const s=document.querySelector('input');s.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch'}));s.value=0;s.dispatchEvent(new Event('input'));});
 expect(await page.locator('aside').textContent()).toContain('WITH PLAN 24 homes');expect(await page.evaluate(()=>commits)).toEqual([1]);
 await page.evaluate(()=>{const s=document.querySelector('input');s.value=40;s.dispatchEvent(new Event('input'));});expect(await page.locator('aside').textContent()).toContain('Unavailable');expect(await slider.getAttribute('aria-valuetext')).toContain('May 2029');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-481-preview-mobile.png'});
 await slider.dispatchEvent('pointerup');await page.waitForTimeout(200);expect(await page.evaluate(()=>commits)).toEqual([1,40]);
 const ms=await page.evaluate(()=>{const s=document.querySelector('input');s.dispatchEvent(new Event('pointerdown'));const start=performance.now();for(let i=0;i<1000;i++){s.value=i%121;s.dispatchEvent(new Event('input'));}const elapsed=performance.now()-start;s.dispatchEvent(new Event('pointercancel'));return elapsed;});console.log(`SHE-481 1000 preview inputs: ${ms.toFixed(2)}ms (Chromium fixture, not device certification)`);
 }finally{await browser?.close();server.stop(true);}
});
