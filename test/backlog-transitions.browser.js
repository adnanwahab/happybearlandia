import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {candidateHooks} from './backlog-transitions-browser-hooks.js';
const appRoot=resolve(process.env.HBL_TRANSITIONS_APP_ROOT||process.cwd());
const {test,expect}=createRequire(resolve(process.env.HBL_TRANSITIONS_TOOLS_ROOT||appRoot,'package.json'))('@playwright/test');
const candidate=process.env.HBL_TRANSITIONS_CANDIDATE_HOOKS==='1';
async function setup(page) {
  for(const name of ['index','metadata'])await page.route(`**/world/decision/backlog-transitions/${name}.js`,async route=>{
    let body=await readFile(new URL(`../world/decision/backlog-transitions/${name}.js`,import.meta.url),'utf8');
    if(name==='index')body=body.replace('export function attachFutureTransitions(', 'function createObservedTransitions(')+`\nexport function attachFutureTransitions(options){const adapter=createObservedTransitions(options);globalThis.__hblTransitionTest=adapter;return adapter;}\n`;
    await route.fulfill({body,contentType:'application/javascript'});
  });
  if(candidate)for(const kind of ['studio','visualizations'])await page.route(`**/world/decision/${kind}.js`,async route=>route.fulfill({body:candidateHooks(await readFile(resolve(appRoot,`world/decision/${kind}.js`),'utf8'),kind),contentType:'application/javascript'}));
  await page.goto('/world/decision.html');
  await expect.poll(()=>page.evaluate(()=>Boolean((window.hblDecisionStudio?.futureTransitions||window.__hblTransitionTest))),{message:'Missing real transition hook. Integrate handoff or explicitly enable candidate response hooks.'}).toBe(true);
  await page.locator('#try-example').click();await page.locator('#auto-preview').uncheck();
  await page.locator('#run-seed').fill('0');await page.locator('#run-seed').dispatchEvent('input');
  await page.locator('#run-count').selectOption('100');await page.locator('#run-experiment').click();
  await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio.state.experiment?.status==='completed'&&!window.hblDecisionStudio.state.busy)).toBe(true);
  const stored=await page.evaluate(()=>{const s=window.hblDecisionStudio.state;return {experimentId:s.experiment.id,experimentSeed:s.experiment.seed,run:s.results.runs.find(r=>r.scenarioId==='plan-a')}});
  expect(stored.experimentSeed).toBe(0);expect(stored.run.status).toBe('completed');
  // Use the normal saved-record reopen path, not an injected run fixture.
  await page.goto(`/world/decision.html?experiment=${stored.experimentId}#futures`);
  await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state.results?.experiment?.id)).toBe(stored.experimentId);
  await page.locator('[data-control="projection"]').click();
  await page.locator('[data-control="rotation"]').fill('-75');await page.locator('[data-control="rotation"]').dispatchEvent('input');
  await page.locator('[data-control="scenario"]').selectOption('plan-a');
  await page.locator('[data-control="search"]').fill('rent < 999999');await page.locator('[data-control="search"]').dispatchEvent('input');
  await page.locator('[data-control="color"]').selectOption('outcome');
  const point=page.locator(`[data-viz="landscape"] circle[data-run-id="${stored.run.id}"]`);await point.focus();await point.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio.state.tracePending)).toBe(false);
  const replay=page.locator('[data-control="replay-year"]');const replayMax=Number(await replay.getAttribute('max'));await replay.fill(replayMax===120?'24':'2');await page.locator('[data-control="replay-year"]').dispatchEvent('input');
  await page.locator('[data-control="enter"]').click();
  await expect.poll(()=>page.evaluate(()=>(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).running)).toBe(false);
  await expect(page.locator('#future-entry-banner')).toBeVisible();
  return stored;
}
const snapshot=page=>page.evaluate(()=>(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).selection);
test('saved experiment seed0, Month24, city/plot round trip, projection and filters retained',async({page},info)=>{
  const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});const stored=await setup(page),before=await snapshot(page);
  expect(before.runId).toBe(stored.run.id);expect(before.seed).toBe(stored.run.seed);expect(before.month).toBe(24);expect(before.comparison.projection??(before.comparison.threeD?'3d':'2d')).toBe('3d');expect(await page.locator('[data-control="rotation"]').inputValue()).toBe('-75');expect(before.comparison.scenarioFilter).toBe('plan-a');
  const controlsBefore=await page.locator('[data-control]').evaluateAll(nodes=>nodes.map(n=>({control:n.dataset.control,value:n.value??null,checked:n.checked??null,pressed:n.getAttribute('aria-pressed')})));
  const metrics=await page.evaluate(()=>JSON.stringify(window.hblDecisionStudio.state.selectedRun.metrics));
  await page.screenshot({path:info.outputPath('saved-month24-city.png')});
  await page.locator('#return-multiverse').click();await expect.poll(()=>page.evaluate(()=>(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).lastResult?.view)).toBe('multiverse');await expect.poll(()=>page.evaluate(()=>(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).running)).toBe(false);
  expect(await snapshot(page)).toEqual(before);expect(await page.locator('[data-control]').evaluateAll(nodes=>nodes.map(n=>({control:n.dataset.control,value:n.value??null,checked:n.checked??null,pressed:n.getAttribute('aria-pressed')})))).toEqual(controlsBefore);expect(await page.evaluate(()=>JSON.stringify(window.hblDecisionStudio.state.selectedRun.metrics))).toBe(metrics);expect(new URL(page.url()).searchParams.get('month')).toBe('24');expect(new URL(page.url()).hash).toBe('#futures');
  await page.screenshot({path:info.outputPath('saved-month24-multiverse.png')});
  const evidence=JSON.stringify({candidateHooks:candidate,stored,before,after:await snapshot(page),errors,consoleErrors},null,2);
  await writeFile(info.outputPath('saved-run-evidence.json'),evidence);await info.attach('saved-run-evidence',{body:evidence,contentType:'application/json'});expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
});
test('saved selection manual interruption, supersession, reduced motion and disposal',async({page},info)=>{
  const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  await setup(page);const before=await snapshot(page);
  const receipts=await page.evaluate(async()=>{const a=(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest);const first=a.flyTo('multiverse');const second=a.flyTo('city');window.dispatchEvent(new WheelEvent('wheel',{deltaY:20}));return [await first,await second]});
  expect(receipts.map(r=>r.reason)).toEqual(['superseded','manual-control']);expect(await snapshot(page)).toEqual(before);
  await page.evaluate(()=>{window.__reducedFlight=(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).flyTo('multiverse')});
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(async()=> (await window.__reducedFlight).reason)).toBe('reduced-motion');
  expect(await page.evaluate(async()=> (await (window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).flyTo('city')).reason)).toBe('reduced-motion');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=> (window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest).flyTo('city'));await page.screenshot({path:info.outputPath('saved-month24-reduced-mobile.png')});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const disposed=await page.evaluate(async()=>{const a=(window.hblDecisionStudio.futureTransitions||window.__hblTransitionTest),p=a.flyTo('multiverse');a.detach();a.detach();const y=scrollY;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {result:await p,running:a.running,y,after:scrollY}});
  expect(disposed.result.reason).toBe('detached');expect(disposed.running).toBe(false);expect(disposed.after).toBe(disposed.y);expect(await snapshot(page)).toEqual(before);
  await writeFile(info.outputPath('lifecycle-evidence.json'),JSON.stringify({candidateHooks:candidate,before,receipts,disposed,errors,consoleErrors},null,2));expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
});
