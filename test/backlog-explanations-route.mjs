// Normal Decision Studio route acceptance. Never injects/mounts the component.
// Run again after coordinator integrates mountBacklogExplanations.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { housingModel, createHousingScenarios } from '../world/models/housing/index.js';
const { chromium, expect } = await import(process.env.HBL_PLAYWRIGHT_MODULE || '@playwright/test');
const sourceRoot = process.env.HBL_EXPLANATIONS_SOURCE_ROOT || process.cwd();
const sourceHead = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {cwd: sourceRoot}).stdout.toString().trim();
const port = process.env.HBL_EXPLANATIONS_ROUTE_PORT || '39932', base = `http://127.0.0.1:${port}`;
const artifacts = await mkdtemp(join(tmpdir(), 'hbl-explanations-route-'));
const log = Bun.file(join(artifacts, 'server.log'));
const server = Bun.spawn(['bun', 'run', 'server.js'], { cwd: sourceRoot, env: { ...process.env, PORT: port, DECISION_STORE_DIR: join(artifacts, 'decision-store') }, stdout: log, stderr: log });
let browser, page; const errors = [];
const report = stage => console.log(JSON.stringify({stage, sourceRoot, artifacts}));
const watchdog = setTimeout(() => { console.error('Harness deadline exceeded'); server.kill(); browser?.close(); }, 90000);
try {
  let ready = false;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(base + '/world/decision.html')).ok) { ready = true; break; } } catch {} await Bun.sleep(100); }
  await Bun.sleep(100);
  if (server.exitCode !== null) throw new Error(`Owned server exited; refusing to use another process on port ${port}. Inspect ${artifacts}/server.log`);
  if (!ready) throw new Error(`Server unavailable; inspect ${artifacts}/server.log`);
  const scenarios = createHousingScenarios().slice(0, 2); scenarios[1].successCriterion = { metricId: 'affordability', operator: 'gte', value: 100 };
  report('creating saved experiment');
  const created = await fetch(base + '/api/decision-experiments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Explanations normal route synthetic mechanics', modelId: housingModel.id, modelVersion: housingModel.version, runs: 100, years: 2, seed: 0, scenarios }) });
  if (!created.ok) throw new Error(await created.text()); const { experiment } = await created.json();
  const started = await fetch(`${base}/api/decision-experiments/${experiment.id}/start`, { method: 'POST' }); if (!started.ok) throw new Error(await started.text());
  report('running actual model');
  let results;
  for (let i = 0; i < 300; i++) { results = await (await fetch(`${base}/api/decision-experiments/${experiment.id}/results`)).json(); if (results.experiment.status === 'completed') break; if (results.experiment.status === 'failed') throw Error('Actual saved run failed'); await Bun.sleep(100); }
  if (results?.experiment.status !== 'completed') throw Error('Actual saved run timed out');
  const failure = results.runs.find(r => r.scenarioId === scenarios[1].id && r.outcome === 'failure'); if (!failure) throw Error('No actual evaluated failures');
  browser = await chromium.launch({headless:true}); page = await browser.newPage({viewport:{width:390,height:844}}); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(20000); report('opening normal route');
  page.on('pageerror', e => errors.push(e.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/world/decision.html?experiment=${experiment.id}#futures`, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(id => window.hblDecisionStudio?.state.results?.experiment?.id === id, experiment.id);
  await page.locator('[data-as-tab="intelligence"]').click();
  const component = page.locator('.backlog-explanations');
  if (!(await component.count())) {
    await page.screenshot({path:join(artifacts,'normal-route-mount-pending.png'),fullPage:true});
    console.log(JSON.stringify({status:'INTEGRATION-BLOCKED',reason:'Normal Decision Studio has no coordinator mount. No component injected.',experimentId:experiment.id,runId:failure.id,actualRuns:results.runs.length,pageErrors:errors,artifacts}));
    process.exitCode = 2;
  } else {
    report('selecting actual failure cluster');
    await component.locator('details').first().locator('summary').click();
    const pick = component.getByRole('button',{name:`Inspect ${failure.id}`,exact:true}); await pick.click();
    await page.waitForFunction(id => window.hblDecisionStudio.state.selectedRun?.id === id && window.hblDecisionStudio.state.selectedRun?.monthlyTimeline?.length > 0, failure.id);
    report('selecting month and querying WHY');
    await page.locator('#building-month').fill('12'); await page.locator('#building-month').dispatchEvent('input');
    await component.getByRole('textbox').fill('Why median rent?'); await component.getByRole('button',{name:'Inspect evidence',exact:true}).click();
    await expect(component.locator('[aria-live]')).toContainText('0 recorded metric-specific mechanisms');
    const selectedMonthValue = failure.monthlyTimeline.find(row => row.month === 12).metrics.median_rent;
    await expect(component.locator('[aria-live]')).toContainText(`recorded as ${selectedMonthValue} `);
    const whyText = await component.locator('[aria-live]').innerText();
    await component.locator('[aria-live]').screenshot({path:join(artifacts,'month-12-why.png')});
    const answer = whyText; if (/month (2[0-9]|1[3-9])\b/.test(answer)) throw Error('Future event leakage');
    await component.getByRole('textbox').fill('What changed in median rent?'); await component.getByRole('button',{name:'Inspect evidence',exact:true}).click();
    await expect(component.locator('[aria-live]')).toContainText('Same-seed modeled comparison');
    const reference = results.runs.find(r => r.scenarioId === scenarios[0].id && r.seed === failure.seed);
    const value = failure.monthlyTimeline.find(r=>r.month===12).metrics.median_rent, previous = reference.monthlyTimeline.find(r=>r.month===12).metrics.median_rent;
    await expect(component.locator('[aria-live]')).toContainText(`change ${value-previous}`);
    const comparisonText = await component.locator('[aria-live]').innerText();
    await component.locator('[aria-live]').screenshot({path:join(artifacts,'month-12-comparison.png')});
    const source = component.getByRole('button',{name:'Inspect source event',exact:true}); const recordedMonth = await source.getAttribute('data-month');
    await source.click();
    await expect(page.locator('#building-month')).toHaveValue(recordedMonth);
    await page.locator('#return-multiverse').click(); await page.locator('[data-as-tab="intelligence"]').click();
    if (await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile horizontal overflow');
    await component.screenshot({path:join(artifacts,'normal-route-mobile.png')});
    await component.getByRole('button',{name:'Play recorded events'}).click();
    await page.goto('about:blank'); await page.waitForTimeout(1300); // normal route disposal/navigation while timer active
    if (errors.length) throw Error(errors.join('\n'));
    const evidence = {status:'DONE',sourceRoot,sourceHead,experimentId:experiment.id,runId:failure.id,referenceRunId:reference.id,seed:failure.seed,modelVersion:failure.modelVersion,engineVersion:failure.engineVersion,month:12,metricId:'median_rent',unit:'USD/month',value,referenceValue:previous,delta:value-previous,recordedSourceMonth:Number(recordedMonth),whyText,comparisonText,actualRuns:results.runs.length,pageErrors:errors,checks:'saved failures, cluster selection, trace hydration, month-bounded WHY, numeric same-seed comparison, source jump, mobile overflow, navigation disposal, no page or console errors',artifacts};
    await Bun.write(join(artifacts,'evidence.json'),JSON.stringify(evidence,null,2));
    console.log(JSON.stringify(evidence));
  }
} catch (error) { if (page) await page.screenshot({path:join(artifacts,'failure.png'),fullPage:false,timeout:5000}).catch(()=>{}); console.error(JSON.stringify({status:'FAILED',error:error.message,pageErrors:errors,sourceRoot,artifacts})); throw error; } finally { clearTimeout(watchdog); await browser?.close(); server.kill(); await server.exited; }
