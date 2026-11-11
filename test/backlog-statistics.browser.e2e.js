import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
const factors=[{id:'construction_capacity',levels:[50000,90000]},{id:'permitting_months',levels:[6,12]}];
async function openSaved(page) {
 await page.goto('/world/decision.html');
 await page.locator('#try-example').click();
 await page.locator('#auto-preview').uncheck();
 await page.locator('#run-count').selectOption('10');
 await page.locator('#run-experiment').click();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblDecisionStudio?.state.experiment?.status==='completed'&&!window.hblDecisionStudio.state.busy))).toBe(true);
 const id=await page.evaluate(()=>window.hblDecisionStudio.state.experiment.id);
 await page.goto(`/world/decision.html?experiment=${encodeURIComponent(id)}`);
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state.results?.experiment?.id)).toBe(id);
 await page.locator('[data-as-tab="intelligence"]').click();
 const panel=page.locator('[data-testid="decision-intelligence"]');
 const section=panel.locator('[data-di-section="dependence"]');
 await section.locator(':scope > summary').click();
 return {panel,section,id};
}
test('saved production Housing run → exact two-factor report and provenance',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {section,id}=await openSaved(page);
 await section.locator('[data-di-action="partial"]').click();
 const diagnostic=await page.evaluate(async()=>{
  const {runHousingCounterfactual}=await import('/world/models/housing/index.js');
  const {results}=window.hblDecisionStudio.state;
  return results.runs.filter(r=>r.scenarioId==='plan-a').slice(0,8).map(run=>{
   const cf=runHousingCounterfactual({run,scenario:results.experiment.scenarios.find(s=>s.id===run.scenarioId),years:results.experiment.years,parameterId:'construction_capacity',value:50000,metricId:'affordability'});
   return {id:run.id,mismatches:cf.recordedMismatch.map(id=>({id,stored:run.metrics[id],rerun:cf.baseline.metrics[id],delta:cf.baseline.metrics[id]-run.metrics[id]}))};
  });
 });
 await writeFile(info.outputPath('cross-engine-reconstruction-audit.json'),JSON.stringify(diagnostic,null,2));
 await info.attach('cross-engine-reconstruction-audit',{body:JSON.stringify(diagnostic,null,2),contentType:'application/json'});
 await expect(section.locator('[data-di-action="partial"]')).toBeEnabled();
 const pdpVisible=await section.getByRole('img',{name:/Executed numerical partial dependence/}).count();
 const pdp=section.locator('figure');
 const pdpRows=await pdp.locator('tbody tr').allTextContents();
 if(pdpVisible) { expect(pdpRows.length).toBeGreaterThan(1);expect(await pdp.locator('circle').count()).toBe(pdpRows.length); }
 const savedBefore=await page.request.get(`/api/decision-experiments/${id}/results?traces=summary`).then(r=>r.json());
 await section.getByLabel('Declared factorial levels').fill(JSON.stringify(factors));
 await section.locator('[data-di-action="factorial"]').click();
 await expect(section).toContainText('4/4 evaluations');
 const report=section.locator('section').filter({has:page.getByRole('heading',{name:'Balanced design variance'})});
 await expect(report).toContainText('Total variance:');
 const details=section.locator('details').filter({has:page.getByText('Design and provenance',{exact:true})});
 await details.locator('summary').click();
 const manifest=JSON.parse(await details.locator('pre').innerText());
 expect(manifest.design.factors).toEqual(factors);expect(manifest.provenance.empirical).toBe(false);
 const source=savedBefore.runs.find(r=>r.id===manifest.provenance.sourceRunId);
 expect(source).toBeTruthy();expect(manifest.design.seeds).toEqual([source.seed]);
 expect(manifest.provenance.modelVersion).toBe(source.modelVersion);
 expect(manifest.provenance.years).toBe(savedBefore.experiment.years);
 // Direct retained simulator calls, independent 2x2 finite ANOVA calculation.
 const reference=await page.evaluate(async manifest=>{
  const {resolveHousingModel}=await import('/world/models/housing/index.js');
  const {input,modelVersion,metricId}=manifest.provenance;
  const simulate=resolveHousingModel(modelVersion).simulateRun;
  const ys=manifest.design.cells.map(parameters=>manifest.design.seeds.map(seed=>simulate({...structuredClone(input),parameters:{...input.parameters,...parameters},seed}).metrics[metricId])).map(v=>v.reduce((s,x)=>s+x,0)/v.length);
  const mean=ys.reduce((s,x)=>s+x,0)/ys.length;
  const total=ys.reduce((s,x)=>s+(x-mean)**2,0)/ys.length;
  const x=(((ys[0]+ys[1])/2-mean)**2+((ys[2]+ys[3])/2-mean)**2)/2;
  const y=(((ys[0]+ys[2])/2-mean)**2+((ys[1]+ys[3])/2-mean)**2)/2;
  return {total,components:[x,y,total-x-y]};
 },manifest);
 const text=await report.innerText();const total=Number(text.match(/Total variance: ([^ ]+)/)[1]);
 expect(total).toBeCloseTo(reference.total,7);
 const rows=await report.locator('tbody tr').evaluateAll(rows=>rows.map(r=>[...r.cells].map(c=>c.textContent)));
 expect(rows).toHaveLength(3);
 rows.forEach((row,i)=>expect(Number(row[1])).toBeCloseTo(reference.components[i],7));
 expect(rows.reduce((s,r)=>s+Number(r[1]),0)).toBeCloseTo(total,7);
 expect(await page.request.get(`/api/decision-experiments/${id}/results?traces=summary`).then(r=>r.json())).toEqual(savedBefore);
 await writeFile(info.outputPath('statistics-production-provenance.json'),JSON.stringify({source:info.config.metadata,manifest,reference,displayedRows:rows,pdpRows},null,2));
 await info.attach('statistics-production-provenance',{body:JSON.stringify({manifest,reference,displayedRows:rows,pdpRows},null,2),contentType:'application/json'});
 await report.scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('statistics-production.png'),animations:'disabled'});expect(errors).toEqual([]);

});
test('production invalid declared design and selection cancellation cannot publish stale decomposition',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {section,panel}=await openSaved(page);
 await section.getByLabel('Declared factorial levels').fill('{');await section.locator('[data-di-action="factorial"]').click();
 await expect(section.getByRole('button',{name:'Execute declared factorial design'})).toBeEnabled();
 await expect(section).not.toContainText('Total variance:');
 const large=[{id:'construction_capacity',levels:[1000,2000,3000,4000,5000]},{id:'permitting_months',levels:[6,7,8,9,10]},{id:'interest_rate',levels:[0.01,0.02,0.03,0.04,0.05]}];
 await section.getByLabel('Declared factorial levels').fill(JSON.stringify([...large,{id:'adoption',levels:[0,1]}]));
 await section.locator('[data-di-action="factorial"]').click();await expect(panel.locator('.di-status')).toContainText('1–3 unique factors');
 await section.getByLabel('Declared factorial levels').fill(JSON.stringify(large));
 const wasBusy=await section.evaluate(section=>{
  section.querySelector('[data-di-action="factorial"]').click();
  // Render replaces the old section synchronously: use the live controls.
  const current=document.querySelector('[data-di-section="dependence"]');
  const busy=current.querySelector('[data-di-action="factorial"]').disabled;
  const control=current.querySelector('[data-di-control="parameter"]');
  control.value='interest_rate';control.dispatchEvent(new Event('change',{bubbles:true}));
  return busy;
 });
 expect(wasBusy).toBe(true);
 await expect(section.locator('[data-di-action="factorial"]')).toBeEnabled();
 // Allow the aborted asynchronous loop to unwind; no synthetic completion.
 await page.waitForTimeout(700);
 await expect(section).not.toContainText('Total variance:');await expect(section).toContainText('No balanced design executed.');
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('statistics-cancelled.png'),animations:'disabled'});expect(errors).toEqual([]);
});
test('browser module incomplete-evaluation contract preserves actual Housing evidence and suppresses fractions',async({page})=>{
 await page.goto('/world/decision.html');
 const result=await page.evaluate(async()=>{
  const {evaluateFactorial}=await import('/world/decision/backlog-statistics/design.js');
  const {factorialReport}=await import('/world/decision/backlog-statistics/view.js');
  const {createHousingScenarios,simulateHousingRun}=await import('/world/models/housing/index.js');
  const actual=[];
  const result=await evaluateFactorial({factors:[{id:'construction_capacity',levels:[50000,90000]}],seeds:[0,4294967295]},({parameters,seed,cell})=>{
   const metric=simulateHousingRun({parameters:{...createHousingScenarios()[1].parameters,...parameters},years:2,seed}).metrics.median_rent;
   actual.push({cell,seed,metric});
   // Explicit post-simulation missing-observation injection tests mechanics;
   // this is not a model failure or an observed production data incident.
   return cell===0&&seed===0?undefined:metric;
  });
  return {result,actual,html:factorialReport(result)};
 });
 expect(result.actual).toHaveLength(4);expect(result.result.status).toBe('incomplete');expect(result.result.components).toBeNull();
 expect(result.html).toContain('1 failed');expect(result.html).toContain('Decomposition unavailable');expect(result.html).not.toContain('Total variance:');
 expect(result.result.evaluations.filter(e=>e.status==='completed').every(e=>e.value===result.actual.find(a=>a.cell===e.cell&&a.seed===e.seed).metric)).toBe(true);
});

test('saved production run renders actual numerical PDP chart',async({page},info)=>{
 const {section,panel}=await openSaved(page);
 await section.locator('[data-di-action="partial"]').click();
 await expect(section.getByRole('img',{name:/Executed numerical partial dependence/})).toBeVisible();
 const rows=section.locator('figure tbody tr');
 expect(await rows.count()).toBeGreaterThan(1);
 expect(await section.locator('figure circle').count()).toBe(await rows.count());
 const points=await rows.evaluateAll(rows=>rows.map(row=>[...row.cells].map(c=>Number(c.textContent))));
 const metricId=await panel.getByLabel('Intelligence metric').inputValue();
 const scenarioId=await panel.getByLabel('Intelligence scenario').inputValue();
 const parameterId=await panel.getByLabel('Dependence parameter').inputValue();
 const expected=await page.evaluate(async({points,metricId,scenarioId,parameterId})=>{
  const {runHousingCounterfactual}=await import('/world/models/housing/index.js');
  const {results}=window.hblDecisionStudio.state;
  const runs=results.runs.filter(r=>r.scenarioId===scenarioId&&r.status==='completed').slice(0,8);
  return points.map(([value])=>{
   const values=runs.map(run=>runHousingCounterfactual({run,scenario:results.experiment.scenarios.find(s=>s.id===scenarioId),years:results.experiment.years,metricId,parameterId,value}).metrics[metricId]);
   return {count:values.length,mean:values.reduce((s,v)=>s+v,0)/values.length};
  });
 },{points,metricId,scenarioId,parameterId});
 points.forEach((point,i)=>{expect(point[1]).toBe(expected[i].count);expect(point[2]).toBeCloseTo(expected[i].mean,9);});
 await writeFile(info.outputPath('statistics-pdp-values.json'),JSON.stringify({points,expected},null,2));
 await section.locator('figure').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('statistics-pdp.png'),animations:'disabled'});
});
