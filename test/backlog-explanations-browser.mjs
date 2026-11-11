// Isolated adapter smoke, NOT production route acceptance. Existing local browser only.
import { resolve, relative } from 'node:path';
const { chromium } = await import(process.env.HBL_PLAYWRIGHT_MODULE || '@playwright/test');
const root = resolve('.');
const server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.HBL_EXPLANATIONS_PORT || 39931), async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === '/') return new Response(`<meta name="viewport" content="width=device-width"><main></main><script type="module">
import {mountBacklogExplanations} from '/world/decision/backlog-explanations/view.js';
import {housingModel,simulateHousingRun,createHousingScenarios} from '/world/models/housing/index.js';
const scenarios=createHousingScenarios().slice(0,2); scenarios[1].successCriterion={metricId:'affordability',operator:'gte',value:100};
const runs=scenarios.flatMap(s=>[0,1,2].map(seed=>({...simulateHousingRun({parameters:s.parameters,seed,years:2}),id:s.id+'-'+seed,scenarioId:s.id,experimentId:'component',engineVersion:'component-test',status:'completed',modelVersion:housingModel.version,seed,sampledParameters:s.parameters})));
const view=mountBacklogExplanations(document.querySelector('main'),{onEvent:e=>window.source=e,onSelectRun:r=>window.selected=r.id});
window.view=view; window.context={results:{experiment:{scenarios},runs,model:housingModel},selectedRun:runs[3]};view.update(window.context);
</script>`, { headers: { 'content-type': 'text/html' } });
  const path = resolve(root, '.' + url.pathname); if (relative(root,path).startsWith('..')) return new Response(null,{status:404});
  const file = Bun.file(path); return await file.exists() ? new Response(file) : new Response(null,{status:404});
} });
let browser;
try {
  browser = await chromium.launch({headless:true}); const page = await browser.newPage({viewport:{width:390,height:844}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.port}`); await page.getByRole('heading',{name:'Failure clusters and recorded explanations'}).waitFor();
  await page.getByRole('textbox').fill('Why did median rent change?'); await page.getByRole('button',{name:'Inspect evidence',exact:true}).click();
  if (!(await page.locator('[aria-live]').innerText()).includes('version-matched programmed rules')) throw Error('Missing grounded answer');
  const baseline = await page.evaluate(()=>window.context.results.runs[0]);
  await page.route('**/api/decision-experiments/component/runs/**', route=>route.fulfill({json:{run:baseline}}));
  await page.evaluate(()=>window.view.update({...window.context,referenceRun:{...window.context.results.runs[0],monthlyTimeline:[],timeline:[]}}));
  await page.getByRole('textbox').fill('Compare median rent'); await page.getByRole('button',{name:'Inspect evidence',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-live]').textContent.includes('Same-seed modeled comparison'));
  await page.unroute('**/api/decision-experiments/component/runs/**');
  let pending; const received = new Promise(resolve=>pending=resolve);
  let finish; const release = new Promise(resolve=>finish=resolve);
  await page.route('**/api/decision-experiments/component/runs/**', async route=>{pending();await release;await route.fulfill({json:{run:baseline}})});
  await page.getByRole('button',{name:'Inspect evidence',exact:true}).click(); await received;
  await page.evaluate(()=>window.view.update(window.context)); finish(); await page.waitForTimeout(100);
  if (await page.locator('[aria-live]').innerText()) throw Error('Stale reference response overwrote updated selection');
  await page.getByRole('button',{name:'Inspect source event'}).click(); if (!(await page.evaluate(()=>window.source?.runId))) throw Error('Source callback missing');
  await page.getByRole('button',{name:'Play recorded events'}).click(); await page.waitForTimeout(1350); await page.getByRole('button',{name:'Pause',exact:true}).click();
  if (await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
  await page.screenshot({path:'/tmp/hbl-backlog-explanations-mobile.png',fullPage:true});
  await page.evaluate(()=>window.view.update({...window.context,selectedRun:null})); if (!(await page.getByRole('button',{name:'Inspect evidence',exact:true}).isDisabled())) throw Error('Stale selected run');
  await page.evaluate(()=>window.view.destroy()); if (await page.locator('.backlog-explanations').count()) throw Error('Destroy failed');
  if (errors.length) throw Error(errors.join('\n')); console.log('PASS: actual housing model component at 390px, query/source/playback/update/destroy; zero page errors. Production mount remains integrator-owned. Screenshot /tmp/hbl-backlog-explanations-mobile.png');
} finally { await browser?.close(); server.stop(true); }
