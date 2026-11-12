// bun scripts/benchmark-population-startup.js http://127.0.0.1:PORT output.json
import {chromium, firefox, webkit} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
import {POPULATION_VERSION} from '../world/population/contracts.js';
const [base, output] = process.argv.slice(2);
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base || '') || !output) {
  throw Error('Supply an isolated local server URL and an output JSON path.');
}
const route = '/world?demo=1&living=0&people=20&seed=42&renderer=webgl&quality=LOW';
const report = {schemaVersion:'population-startup.v1', recordedAt:new Date().toISOString(),
  machine:{platform:os.platform(), release:os.release(), arch:os.arch(), totalMemoryBytes:os.totalmem(), cpu:os.cpus()[0]?.model},
  route, seed:42, modelVersion:POPULATION_VERSION, coldDefinition:'New browser process and fresh context for each engine; OS and server caches are not cleared.',
  limitations:['Chromium, Firefox and WebKit are automated engines; WebKit is not shipping Safari.',
    'JS heap excludes worker, GPU and native memory. Missing memory APIs return null.',
    'The opt-out route tests existing on-demand startup, not default auto-activation or a million-resident backend.',
    'First animation callback is a scheduling observation, not proof of a presented WebGL frame.'], browsers:[]};
let failed = false;
for (const [name, engine] of Object.entries({chromium, firefox, webkit})) {
  const row = {engine:name}; report.browsers.push(row);
  let browser;
  try {
    browser = await engine.launch({headless:true, ...(name === 'chromium' ? {args:['--enable-unsafe-swiftshader']} : {})});
  } catch (error) { row.status='unavailable'; row.reason=error.message; continue; }
  try {
    row.version=browser.version();
    const context=await browser.newContext({viewport:{width:1200,height:900}});
    const page=await context.newPage(), errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.__startup={firstAnimationCallbackMs:null, workers:[]};
      requestAnimationFrame(()=>window.__startup.firstAnimationCallbackMs=performance.now());
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker {
        constructor(url, options) {super(url, options); window.__startup.workers.push(String(url));}
      };
    });
    await page.goto(base+route);
    await page.waitForFunction(()=>Boolean(window.hblLivingWorld),null,{timeout:90000});
    row.before=await page.evaluate(()=>({
      ...window.__startup, elapsedMs:performance.now(),
      populationRuntimePresent:Boolean(window.hblLivingWorld.getRuntime()),
      heapUsedBytes:performance.memory?.usedJSHeapSize??null,
      deviceMemoryGiB:navigator.deviceMemory??null, userAgent:navigator.userAgent,
    }));
    assert.equal(row.before.populationRuntimePresent,false);
    assert.equal(row.before.workers.some(url=>url.includes('population.worker')),false);
    // A real toolbar interaction uses the normal application entry point.
    await page.getByTestId('add-population').click();
    await page.waitForFunction(()=>window.hblLivingWorld.getRuntime()?.getSnapshot()?.config.population===10000,null,{timeout:90000});
    row.after=await page.evaluate(()=>{
      const runtime=window.hblLivingWorld.getRuntime(); runtime.pause();
      const snapshot=runtime.getSnapshot();
      return {elapsedMs:performance.now(), config:snapshot.config, modelVersion:snapshot.modelVersion??null,
        provenance:snapshot.provenance, runtime:snapshot.runtime, visibleAgents:snapshot.visibleAgents.length,
        heapUsedBytes:performance.memory?.usedJSHeapSize??null};
    });
    assert.equal(row.after.config.seed,42);
    assert.ok(row.after.visibleAgents<=500);
    assert.deepEqual(errors,[]);
    row.status='passed';
  } catch(error) {row.status='failed'; row.reason=error.stack; failed=true;}
  finally {await browser.close();}
}
await writeFile(output, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.browsers.map(({engine,status})=>({engine,status}))));
if(failed || !report.browsers.some(row=>row.status==='passed')) process.exitCode=1;
