import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
const threeBuild=dirname(createRequire(import.meta.url).resolve('three'));

test('Living City offers explicit smaller startup and preserves changed fidelity evidence',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/vendor/three/**',async route=>{const name=new URL(route.request().url()).pathname.slice('/vendor/three/'.length);await route.fulfill({body:await readFile(name.startsWith('addons/')?join(threeBuild,'../examples/jsm',name.slice(7)):join(threeBuild,name)),contentType:'text/javascript'});});
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;let failed=false;
  window.Worker=class extends NativeWorker{
   postMessage(data,...rest){if(!failed&&String(this.__url).includes('population.worker')&&data.kind==='snapshot'){failed=true;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'TASK_ERROR',taskId:data.taskId,error:'Array buffer allocation failed'}})));return;}return super.postMessage(data,...rest);}
   constructor(url,options){super(url,options);this.__url=String(url);}
  };
 });
 await page.goto('/world/?synthetic=1&renderer=canvas2d&seed=42');
 const retry=page.locator('[data-lc-memory-retry]');await expect(retry).toBeVisible({timeout:60000});
 await expect(page.locator('[data-lc-memory-status]')).toContainText('no matched-person precision');
 await expect(retry).toContainText('10,000 → 5,000');await retry.click();
 await expect(page.locator('[data-lc-memory-status]')).toContainText('Changed fidelity: 10,000 → 5,000',{timeout:60000});
 await expect(retry).toBeHidden();
 const state=await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot());
 expect(state.population).toBe(5000);expect(state.runtime.paused).toBe(true);expect(state.config.seed).toBe(42);expect(state.resetProvenance.memoryRecovery.beforePopulation).toBe(10000);
 expect(errors).toEqual([]);await page.evaluate(()=>window.hblLivingWorld.destroy());
});
