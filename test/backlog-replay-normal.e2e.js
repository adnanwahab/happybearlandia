import { createRequire } from 'node:module';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
const source = process.env.HBL_REPLAY_SOURCE_ROOT;
const require = createRequire(join(source, 'package.json'));
const { test, expect } = require('@playwright/test');
const { createHousingScenarios } = require(join(source, 'world/models/housing/index.js'));
const { execFileSync } = require('node:child_process');
const pin = value => ({ id: value.checkpoint.id, digest: value.checkpoint.digest });
async function post(page, path, payload) {
  return page.evaluate(async ({path,payload}) => {
    const response = await fetch(path, {method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    return {status:response.status,body:await response.json()};
  }, {path,payload});
}

// No injected mount, DOM host, route interception, or component imports.
// The normal production Studio must supply and update the checkpoint panel.
test('normal selected-future page saves, loads, approves nested forks and invalidates stale source', async ({page}, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const consoleErrors = []; page.on('console', message => { if(message.type()==='error') consoleErrors.push(message.text()); });
  await page.goto('/game', {waitUntil:'domcontentloaded'});
  const created = await post(page, '/api/decision-experiments', {schemaVersion:'decision-experiment.v1',name:'Normal checkpoint workflow',decision:'Replay exact selected housing future',modelId:'housing.v1',modelVersion:'1.2.0',seed:0,runs:2,years:10,scenarios:[createHousingScenarios()[0]]});
  expect(created.status,JSON.stringify(created.body)).toBe(201);
  const experimentId=created.body.experiment.id;
  expect((await post(page,`/api/decision-experiments/${experimentId}/start`,{})).status).toBe(202);
  await expect.poll(async()=> (await(await page.request.get(`/api/decision-experiments/${experimentId}`)).json()).experiment.status,{timeout:60000}).toBe('completed');
  const listing=await(await page.request.get(`/api/decision-experiments/${experimentId}/runs`)).json();
  const runs=listing.runs.filter(run=>run.status==='completed');expect(runs).toHaveLength(2);
  const runId=runs[0].id;
  await page.goto(`/world/decision.html?experiment=${experimentId}#futures`,{waitUntil:'domcontentloaded'});
  await page.getByLabel('Construction future',{exact:true}).selectOption(runId);
  await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state?.selectedRun?.id)).toBe(runId);
  const monthSlider=page.getByLabel('Construction replay month',{exact:true});
  await monthSlider.focus();await monthSlider.press('Home');
  await monthSlider.press('PageUp');await monthSlider.press('PageUp');
  await expect(monthSlider).toHaveValue('24');
  for(let step=0;step<9;step++)await monthSlider.press('ArrowRight');
  await expect(monthSlider).toHaveValue('24.9');
  const ui=page.getByRole('region',{name:'Housing checkpoints'});
  await expect(ui).toBeVisible();await expect(ui).toContainText(`Source ${experimentId} / ${runId} · selected month 24`);
  const status=ui.getByRole('status'),receipt=ui.getByLabel('Checkpoint receipt (JSON)'),target=ui.getByLabel('Target completed month'),operations=ui.getByLabel('Forward operations (JSON array)');
  await ui.getByRole('button',{name:'Save selected month',exact:true}).click();
  await expect(status).toContainText('Checkpoint available at month 24');
  const rootReceipt=JSON.parse(await receipt.inputValue());
  const call=payload=>post(page,'/api/decision-checkpoints',{experimentId,runId,...payload});
  const root=await call({action:'load',checkpoint:rootReceipt});expect(root.status).toBe(200);
  expect(root.body.checkpoint.recipe.seed).toBe(runs[0].seed);
  await ui.getByRole('button',{name:'Load receipt',exact:true}).click();await expect(status).toContainText('Checkpoint available at month 24');
  let previous=root.body;
  for(const [month,edits] of [[48,[{op:'set_parameter',target:'construction_capacity',value:1000}]],[72,[{op:'apply_stress_preset',target:'stressPresets',value:'recession'}]]]) {
    await target.fill(String(month));await operations.fill(JSON.stringify(edits));
    await ui.getByRole('button',{name:'Review fork',exact:true}).click();
    const approve=ui.getByRole('button',{name:'Approve exact fork',exact:true});await expect(approve).toBeEnabled();
    const preview=JSON.parse(await ui.locator('pre').textContent());expect(preview.operations).toEqual(edits);expect(preview.targetMonth).toBe(month);
    const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/decision-checkpoints'&&response.request().postDataJSON()?.approval===true);
    await approve.click();const response=await responsePromise;expect(response.status()).toBe(201);
    expect(response.request().postDataJSON().previewHash).toBe(preview.previewHash);
    const child=await response.json();await expect(status).toContainText(`Checkpoint available at month ${month}`);
    expect(child.checkpoint.parentDigest).toBe(previous.checkpoint.digest);
    expect(child.checkpoint.state.monthlyTimeline.slice(0,previous.checkpoint.state.month+1)).toEqual(previous.checkpoint.state.monthlyTimeline);
    previous=child;
  }
  expect(previous.checkpoint.lineage).toHaveLength(2);
  await target.fill('120');await ui.getByRole('button',{name:'Resume to target',exact:true}).click();await expect(status).toContainText('Checkpoint available at month 120');
  const finalReceipt=JSON.parse(await receipt.inputValue());
  const final=await call({action:'load',checkpoint:finalReceipt});expect(final.status).toBe(200);
  expect(final.body.checkpoint.state.month).toBe(120);expect(final.body.checkpoint.lineage).toEqual(previous.checkpoint.lineage);
  expect((await call({action:'load',checkpoint:rootReceipt})).body.serialized).toBe(root.body.serialized);
  await ui.screenshot({path:info.outputPath('normal-checkpoint-nested-resume.png')});
  await receipt.fill(JSON.stringify(rootReceipt));await ui.getByRole('button',{name:'Load receipt',exact:true}).click();await expect(status).toContainText('Checkpoint available at month 24');
  await target.fill('48');await operations.fill('[]');await ui.getByRole('button',{name:'Review fork',exact:true}).click();
  const approve=ui.getByRole('button',{name:'Approve exact fork',exact:true});await expect(approve).toBeEnabled();
  await monthSlider.focus();await monthSlider.press('ArrowRight');await expect(monthSlider).toHaveValue('25');
  await expect(approve).toBeDisabled();await expect(receipt).toHaveValue('');await expect(ui).toContainText('selected month 25');
  await ui.getByRole('button',{name:'Save selected month',exact:true}).click();await expect(status).toContainText('Checkpoint available at month 25');
  await target.fill('49');await ui.getByRole('button',{name:'Review fork',exact:true}).click();await expect(approve).toBeEnabled();
  await page.getByLabel('Construction future',{exact:true}).selectOption(runs[1].id);
  await expect(approve).toBeDisabled();await expect(receipt).toHaveValue('');await expect(ui).toContainText(` / ${runs[1].id}`);
  expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
  const evidence={sourceRoot:source,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),experimentId,runId,seed:runs[0].seed,root:rootReceipt,final:finalReceipt,lineage:final.body.checkpoint.lineage,recipeDigest:final.body.checkpoint.recipeDigest,modelVersion:final.body.checkpoint.modelVersion,normalPageMounted:true,testInjectedHost:false,fractionalPlaybackMonth:24.9,checkpointRecordedMonth:24,unexpectedPageErrors:errors,unexpectedConsoleErrors:consoleErrors};
  await writeFile(info.outputPath('normal-checkpoint-provenance.json'),JSON.stringify(evidence,null,2));
});
