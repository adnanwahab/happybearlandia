import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const source = process.env.HBL_REPLAY_SOURCE_ROOT;
const require = createRequire(join(source, 'package.json'));
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { createHousingScenarios, simulateHousingRun } = require(join(source, 'world/models/housing/index.js'));
const { canonicalJSON, canonicalDigest } = require(join(source, 'world/replay/engine.js'));
const storage = process.env.HBL_REPLAY_ACCEPTANCE_STORE;

// Browser fetches carry actual HttpOnly cookies. No injected owner header or mock handler.
async function post(page, path, payload) {
  return page.evaluate(async ({ path, payload }) => {
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }, { path, payload });
}
const pin = value => ({ id: value.checkpoint.id, digest: value.checkpoint.digest });

test('actual loopback browser capability: recorded run → disk checkpoint → two approved forks → restart', async ({ page, browser, baseURL }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/game');
  expect((await post(page, '/api/decision-checkpoints', {})).status).toBe(401);
  const capability = await post(page, '/api/local-capability', {});
  expect(capability.status).toBe(200);
  const cookie = (await page.context().cookies(baseURL + '/api')).find(cookie => cookie.name === 'hbl_local_cap');
  expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Strict'); expect(cookie.path).toBe('/api');
  expect(await page.evaluate(() => document.cookie)).not.toContain('hbl_local_cap');
  const scenario = createHousingScenarios()[0];
  const created = await post(page, '/api/decision-experiments', { schemaVersion: 'decision-experiment.v1', name: 'Checkpoint actual endpoint acceptance', decision: 'Inspect exact housing replay', modelId: 'housing.v1', modelVersion: '1.2.0', seed: 0, runs: 1, years: 10, scenarios: [scenario] });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const experimentId = created.body.experiment.id;
  expect((await post(page, `/api/decision-experiments/${experimentId}/start`, {})).status).toBe(202);
  await expect.poll(async () => {
    const response = await page.request.get(`/api/decision-experiments/${experimentId}`);
    return (await response.json()).experiment.status;
  }, { timeout: 60000 }).toBe('completed');
  const listing = await (await page.request.get(`/api/decision-experiments/${experimentId}/runs`)).json();
  const selected = listing.runs.find(run => run.status === 'completed');
  expect(selected).toBeTruthy();
  const trace = await (await page.request.get(`/api/decision-experiments/${experimentId}/runs/${selected.id}`)).json();
  const run = trace.run || trace;
  const scope = { experimentId, runId: selected.id };
  const call = payload => post(page, '/api/decision-checkpoints', { ...scope, ...payload });
  const start = await call({ action: 'start', month: 24, ownerId: 'ignored-client-owner' });
  expect(start.status, JSON.stringify(start.body)).toBe(201);
  const root = start.body;
  expect(root.checkpoint.recipe.seed).toBe(selected.seed);
  expect(root.checkpoint.modelVersion).toBe('1.2.0');
  expect(root.result.monthlyTimeline).toEqual(run.monthlyTimeline.slice(0, 25));
  const loaded = await call({ action: 'load', checkpoint: pin(root), ownerId: 'different-ignored-owner' });
  expect(loaded.status).toBe(200); expect(loaded.body.serialized).toBe(root.serialized);
  const foreign = await browser.newContext(); const other = await foreign.newPage(); await other.goto(baseURL + '/game');
  expect((await post(other, '/api/local-capability', {})).status).toBe(200);
  expect((await post(other, '/api/decision-checkpoints', { ...scope, action: 'load', checkpoint: pin(root), ownerId: cookie.value.split('.')[0] })).status).toBe(400);
  await foreign.close();
  let current = root;
  for (const [month, operations] of [[48, [{ op: 'set_parameter', target: 'construction_capacity', value: 1000 }]], [72, [{ op: 'apply_stress_preset', target: 'stressPresets', value: 'recession' }]]]) {
    const payload = { action: 'fork', month, operations, checkpoint: pin(current) };
    const preview = await call(payload); expect(preview.status).toBe(200); expect(preview.body.requiresApproval).toBe(true);
    expect((await call({ ...payload, approval: true, previewHash: 'false-preview' })).status).toBe(409);
    const response = await call({ ...payload, approval: true, previewHash: preview.body.previewHash });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const child = response.body;
    expect(child.checkpoint.parentDigest).toBe(current.checkpoint.digest);
    expect(child.checkpoint.recipeDigest).toBe(root.checkpoint.recipeDigest);
    expect(child.result.monthlyTimeline.slice(0, current.checkpoint.state.month + 1)).toEqual(current.result.monthlyTimeline);
    expect(child.result.events.filter(event => event.month <= current.checkpoint.state.month)).toEqual(current.result.events);
    current = child;
  }
  expect(current.checkpoint.lineage).toHaveLength(2);
  const final = await call({ action: 'resume', month: 120, checkpoint: pin(current) }); expect(final.status).toBe(201);
  const repeat = await call({ action: 'resume', month: 120, checkpoint: pin(current) });
  // An identical replay must reproduce the immutable checkpoint, not rewrite it.
  expect(repeat.status).toBe(201); expect(repeat.body.serialized).toBe(final.body.serialized);
  const finalLoad = await call({ action: 'load', checkpoint: pin(final.body) }); expect(finalLoad.status).toBe(200);
  expect(finalLoad.body.serialized).toBe(final.body.serialized);
  expect((await call({ action: 'load', checkpoint: pin(root) })).body.serialized).toBe(root.serialized);
  const control = await call({ action: 'resume', month: 120, checkpoint: pin(root) }); expect(control.status).toBe(201);
  expect(control.body.result).toEqual(simulateHousingRun(root.checkpoint.recipe));
  const headers = { origin: 'https://foreign.invalid' };
  expect((await page.request.post('/api/local-capability', { headers })).status()).toBe(403);
  expect((await page.request.post('/api/decision-checkpoints', { data: scope, headers })).status()).toBe(401);
  const oversized = await call({ action: 'load', checkpoint: pin(root), padding: 'x'.repeat(17000) }); expect(oversized.status).toBe(413);
  expect((await call({ action: 'load', checkpoint: { ...pin(root), digest: 'wrong' } })).status).toBe(400);
  expect((await call({ action: 'load', checkpoint: { id: 'housing:sha256:' + '0'.repeat(64), digest: root.checkpoint.digest } })).status).toBe(400);
  const forged = await page.request.post('/api/decision-checkpoints', { data: { ...scope, action: 'load', checkpoint: pin(root) }, headers: { cookie: 'hbl_local_cap=' + cookie.value.slice(0, -2) + 'XX' } });
  expect(forged.status()).toBe(401);
  const files = await readdir(join(storage, 'checkpoints'));
  const envelopes = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => ({ file, record: JSON.parse(await readFile(join(storage, 'checkpoints', file), 'utf8')) })));
  const persisted = envelopes.find(item => JSON.parse(item.record.serialized).id === root.checkpoint.id);
  expect(persisted).toBeTruthy();
  const originalDisk = await readFile(join(storage, 'checkpoints', persisted.file), 'utf8');
  for (const version of ['modelVersion', 'engineVersion', 'rulesVersion', 'recipeVersion']) {
    const record = JSON.parse(originalDisk), checkpoint = JSON.parse(record.serialized);
    checkpoint[version] = 'unsupported'; delete checkpoint.digest; checkpoint.digest = await canonicalDigest(checkpoint); record.serialized = canonicalJSON(checkpoint);
    await writeFile(join(storage, 'checkpoints', persisted.file), canonicalJSON(record));
    const rejected = await call({ action: 'load', checkpoint: pin(root) }); expect(rejected.status).toBe(400); expect(rejected.body.error).toBe('Checkpoint rejected');
  }
  await writeFile(join(storage, 'checkpoints', persisted.file), '{"corrupt":');
  expect((await call({ action: 'load', checkpoint: pin(root) })).status).toBe(400);
  await writeFile(join(storage, 'checkpoints', persisted.file), originalDisk);
  expect((await call({ action: 'load', checkpoint: pin(root) })).body.serialized).toBe(root.serialized);
  await page.goto(`/world/decision.html?experiment=${experimentId}&readonly=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#run-experiment')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.hblDecisionStudio?.state?.experiment?.id), { timeout: 30000 }).toBe(experimentId);
  await page.screenshot({ path: info.outputPath('actual-decision-checkpoint-api-source.png'), fullPage: true });
  const evidence = JSON.stringify({ sourceRoot: source, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(), experimentId, runId: selected.id, seed: selected.seed, source: 'actual API run, synthetic housing model', root: pin(root), final: pin(final.body), lineage: current.checkpoint.lineage, expiresAt: root.expiresAt, apiAcceptance: true, checkpointControlsVerified: false, errors }, null, 2);
  await writeFile(info.outputPath('actual-checkpoint-provenance.json'), evidence);
  await info.attach('actual-checkpoint-provenance', { body: evidence, contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('checkpoint component uses real source selection and exact approval; stale edits cancel and dispose', async ({ page }, info) => {
  await page.goto('/game', { waitUntil: 'domcontentloaded' });
  const scenario = createHousingScenarios()[0];
  const created = await post(page, '/api/decision-experiments', { schemaVersion: 'decision-experiment.v1', name: 'Checkpoint component acceptance', decision: 'Inspect nested replay', modelId: 'housing.v1', modelVersion: '1.2.0', seed: 42, runs: 1, years: 10, scenarios: [scenario] });
  expect(created.status).toBe(201); const experimentId = created.body.experiment.id;
  expect((await post(page, `/api/decision-experiments/${experimentId}/start`, {})).status).toBe(202);
  await expect.poll(async () => (await (await page.request.get(`/api/decision-experiments/${experimentId}`)).json()).experiment.status, { timeout: 60000 }).toBe('completed');
  const listing = await (await page.request.get(`/api/decision-experiments/${experimentId}/runs`)).json(); const runId = listing.runs[0].id;
  // Serve only the owned production component asset; all API traffic uses the real server.
  const componentSource = await readFile(new URL('../world/decision/backlog-replay/ui.js', import.meta.url), 'utf8');
  await page.route('**/__replay-ui.js', route => route.fulfill({ contentType: 'text/javascript', body: componentSource }));
  await page.goto(`/world/decision.html?experiment=${experimentId}&run=${runId}&month=25#futures`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.hblDecisionStudio?.state?.selectedRun?.id), { timeout: 30000 }).toBe(runId);
  await page.evaluate(async () => {
    const { mount } = await import('/__replay-ui.js');
    const container = document.createElement('div'); container.id = 'checkpoint-acceptance-host'; document.body.prepend(container);
    window.__checkpointMonth = 25;
    window.__checkpointUI = mount(container, { fetch: async (...args) => { const response = await fetch(...args); if (window.__holdCheckpoint && args[0] === '/api/decision-checkpoints') await new Promise(resolve => { window.__releaseResponse = resolve; }); return response; }, getContext: () => ({ experimentId: window.hblDecisionStudio.state.experiment.id, runId: window.hblDecisionStudio.state.selectedRun?.id, month: window.__checkpointMonth, years: window.hblDecisionStudio.state.experiment.years }) });
  });
  const ui = page.getByRole('region', { name: 'Housing checkpoints' });
  await ui.getByRole('button', { name: 'Save selected month', exact: true }).click();
  await expect(ui.getByRole('status')).toContainText('Checkpoint available at month 25', { timeout: 30000 });
  const rootReceipt = await ui.getByLabel('Checkpoint receipt (JSON)').inputValue();
  await ui.getByRole('button', { name: 'Load receipt', exact: true }).click();
  await expect(ui.getByRole('status')).toContainText('Checkpoint available at month 25');
  const target = ui.getByLabel('Target completed month'), ops = ui.getByLabel('Forward operations (JSON array)');
  const approve = ui.getByRole('button', { name: 'Approve exact fork', exact: true });
  await target.fill('49'); await ops.fill('[{"op":"set_parameter","target":"construction_capacity","value":1000}]');
  await ui.getByRole('button', { name: 'Review fork', exact: true }).click();
  await expect(approve).toBeEnabled();
  await target.fill('50'); await expect(approve).toBeDisabled();
  await target.fill('49'); await ui.getByRole('button', { name: 'Review fork', exact: true }).click(); await expect(approve).toBeEnabled();
  await ops.fill('[]'); await expect(approve).toBeDisabled();
  await ops.fill('[{"op":"set_parameter","target":"construction_capacity","value":1000}]');
  await ui.getByRole('button', { name: 'Review fork', exact: true }).click(); await expect(approve).toBeEnabled();
  await approve.click(); await expect(ui.getByRole('status')).toContainText('Checkpoint available at month 49');
  await target.fill('73'); await ops.fill('[{"op":"apply_stress_preset","target":"stressPresets","value":"recession"}]');
  await ui.getByRole('button', { name: 'Review fork', exact: true }).click(); await expect(approve).toBeEnabled(); await approve.click();
  await expect(ui.getByRole('status')).toContainText('Checkpoint available at month 73');
  expect(await ui.locator('pre').textContent()).toContain('parentCheckpointId');
  await target.fill('120'); await ui.getByRole('button', { name: 'Resume to target', exact: true }).click();
  await expect(ui.getByRole('status')).toContainText('Checkpoint available at month 120');
  const finalReceipt = await ui.getByLabel('Checkpoint receipt (JSON)').inputValue();
  await ui.screenshot({ path: info.outputPath('actual-checkpoint-nested-resume.png') });
  await ui.getByLabel('Checkpoint receipt (JSON)').fill(rootReceipt); await ui.getByRole('button', { name: 'Load receipt', exact: true }).click();
  await expect(ui.getByRole('status')).toContainText('Checkpoint available at month 25');
  expect(await ui.getByLabel('Checkpoint receipt (JSON)').inputValue()).toBe(rootReceipt);
  await ui.getByLabel('Checkpoint receipt (JSON)').fill('invalid'); await ui.getByRole('button', { name: 'Load receipt', exact: true }).click();
  await expect(ui.getByRole('status')).toContainText(/JSON/);
  await ui.getByLabel('Checkpoint receipt (JSON)').fill(finalReceipt); await target.fill('120');
  await ui.getByRole('button', { name: 'Review fork', exact: true }).click(); await expect(approve).toBeEnabled();
  // Host source-time update clears the receipt and exact-approval state.
  await page.evaluate(() => { window.__checkpointMonth = 26; window.__checkpointUI.update(); });
  await expect(approve).toBeDisabled(); await expect(ui.getByLabel('Checkpoint receipt (JSON)')).toHaveValue('');
  // Delay delivery of the actual response to deterministically test cancellation,
  // source changes and disposal; the endpoint still performs its real disk write.
  await page.evaluate(() => { window.__holdCheckpoint = true; });
  await ui.getByRole('button', { name: 'Save selected month', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__releaseResponse))).toBe(true);
  await ui.getByRole('button', { name: 'Cancel request', exact: true }).click();
  await page.evaluate(() => { window.__releaseResponse(); window.__releaseResponse = null; });
  await expect(ui.getByRole('status')).toContainText('cancelled locally');
  await expect(ui.getByLabel('Checkpoint receipt (JSON)')).toHaveValue('');
  await page.evaluate(() => { window.__checkpointMonth = 27; window.__checkpointUI.update(); });
  await ui.getByRole('button', { name: 'Save selected month', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__releaseResponse))).toBe(true);
  await page.evaluate(() => { window.__checkpointMonth = 28; window.__checkpointUI.update(); window.__releaseResponse(); window.__releaseResponse = null; });
  await expect(ui.getByLabel('Checkpoint receipt (JSON)')).toHaveValue('');
  await ui.screenshot({ path: info.outputPath('actual-checkpoint-component.png') });
  await writeFile(info.outputPath('actual-checkpoint-component-provenance.json'), JSON.stringify({ experimentId, runId, seed: listing.runs[0].seed, rootReceipt: JSON.parse(rootReceipt), finalReceipt: JSON.parse(finalReceipt), source: 'owned component mounted by acceptance harness on actual Decision Studio selection', hostMountIntegrated: false, actualProductionEndpoint: true }, null, 2));
  await ui.getByRole('button', { name: 'Save selected month', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__releaseResponse))).toBe(true);
  await page.evaluate(() => { window.__checkpointUI.destroy(); window.__releaseResponse(); });
  await expect(ui).toHaveCount(0);
});
