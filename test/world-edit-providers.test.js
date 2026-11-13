import { describe, expect, test } from 'bun:test';
import { createHousingScenarios, housingModel } from '../world/models/housing/index.js';
import { getWorldEditProviders, proposeWorldEdit, buildProviderContext, requestProviderJson } from '../world/ai/provider.js';
import { createWorldEditApiHandler } from '../world/ai/provider-api.js';
const input = () => ({ schemaVersion: 'decision-experiment.v1', name: 'Provider test', decision: 'Housing policy', modelId: housingModel.id, modelVersion: housingModel.version, seed: 42, runs: 10, years: 10, scenarios: createHousingScenarios(), metadata: {} });
const args = (world = input()) => ({ worldState: world, scenario: world.scenarios[1], provider: 'demo', env: {} });
const envelope = (operations = [{ op: 'set_parameter', target: 'construction_capacity', value: 86400 }]) => ({ summary: 'Explicit test proposal', operationsJson: JSON.stringify(operations), requiresSimulationRerun: false, warnings: [] });
function vendorResponse(id, value = envelope()) {
  const text = JSON.stringify(value);
  return Response.json(id === 'openai' ? { status: 'completed', output: [{ content: [{ type: 'output_text', text }] }] } : id === 'anthropic' ? { stop_reason: 'end_turn', content: [{ type: 'text', text }] } : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
}
const envFor = id => ({ [`${id.toUpperCase()}_API_KEY`]: 'SECRET_TEST_KEY', [`${id.toUpperCase()}_MODEL`]: 'test-structured-model' });

describe('world-edit providers (mocked network only)', () => {
  test('capabilities expose no keys and require explicit model configuration', () => {
    const config = getWorldEditProviders({ OPENAI_API_KEY: 'SECRET_TEST_KEY' });
    expect(config.defaultProvider).toBe('demo');
    expect(config.providers.find(p => p.id === 'openai').configured).toBe(false);
    expect(JSON.stringify(config)).not.toContain('SECRET_TEST_KEY');
    expect(config.providers.every(p => p.capabilities.codeEditing === false)).toBe(true);
  });
  test('local tower request is a pure validated proposal with 300 homes and 75 affordable', async () => {
    const world = input(), before = JSON.stringify(world);
    const proposal = await proposeWorldEdit({ ...args(world), prompt: 'Build a 300-unit residential tower next to the station, with 25% affordable housing.' });
    expect(proposal.schemaVersion).toBe('world-edit.v1');
    expect(proposal.provider).toBe('demo');
    expect(proposal.operations[0].value.program.residentialUnits).toBe(300);
    expect(proposal.operations[0].value.program.affordableUnits).toBe(75);
    expect(proposal.operations[0].value.status).toBe('proposed');
    expect(proposal.baseRevision).toBe('root');
    expect(JSON.stringify(world)).toBe(before);
  });
  test('relative capacity, uncertainty, immediate stress and visuals have actual typed operations', async () => {
    for (const [prompt, op, target] of [['Make construction capacity 20% higher', 'set_parameter','construction_capacity'], ['Increase migration uncertainty', 'set_uncertainty','migration'], ['Apply a recession', 'apply_stress_preset','stressPresets'], ['Make downtown buildings taller', 'change_world_visual','heightScale']]) {
      const proposal = await proposeWorldEdit({ ...args(), prompt });
      expect(proposal.operations[0].op).toBe(op); expect(proposal.operations[0].target).toBe(target);
      expect(proposal.requiresSimulationRerun).toBe(op !== 'change_world_visual');
      if (op === 'set_parameter') expect(proposal.operations[0].value).toBe(86400);
    }
  });
  test('unsupported infrastructure and model-code requests fail honestly', async () => {
    for (const prompt of ['Add a light-rail station here', 'Create a new metric', 'Change the equation', 'Do something arbitrary']) await expect(proposeWorldEdit({ ...args(), prompt })).rejects.toThrow();
  });
  test('a Year 3 recession is explicitly scheduled at month 24 when modeled', async () => {
    const proposal = await proposeWorldEdit({ ...args(), prompt: 'Add a recession beginning in Year 3' });
    expect(proposal.operations[0].value).toEqual({ presetId: 'recession', startMonth: 24 });
    expect(proposal.requiresSimulationRerun).toBe(true);
  });
  test('parameter selection scopes uncertainty without forwarding raw selection records', async () => {
    const proposal = await proposeWorldEdit({ ...args(), prompt: 'Make this assumption more uncertain', selection: { kind: 'parameter', id: 'interest_rate', customerRecords: 'SECRET_CUSTOMER' } });
    expect(proposal.operations[0].target).toBe('interest_rate');
  });
  for (const id of ['openai', 'anthropic', 'gemini']) test(`${id} uses its structured API, strips private context, and returns independent validator output`, async () => {
    const world = input(); world.metadata = { journal: 'SECRET_JOURNAL', evidence: 'SECRET_EVIDENCE', customerRecords: 'SECRET_CUSTOMER' };
    world.scenarios[1].notes = 'SECRET_NOTES';
    world.scenarios[1].projects = [];
    const before = JSON.stringify(world); let captured;
    const proposal = await proposeWorldEdit({ ...args(world), provider: id, env: envFor(id), prompt: 'Make construction capacity 20% higher', fetchImpl: async (url, options) => { captured = { url, options, body: JSON.parse(options.body) }; return vendorResponse(id); } });
    expect(proposal.schemaVersion).toBe('world-edit.v1');
    expect(proposal.provider).toBe(id);
    expect(proposal.requiresSimulationRerun).toBe(true); // provider claimed false
    expect(JSON.stringify(captured.body)).not.toContain('SECRET_');
    expect(JSON.stringify(world)).toBe(before);
    expect(captured.options.redirect).toBe('error');
    if (id === 'openai') { expect(captured.body.store).toBe(false); expect(captured.body.text.format.strict).toBe(true); }
    if (id === 'anthropic') expect(captured.body.output_config.format.type).toBe('json_schema');
    if (id === 'gemini') { expect(captured.url).not.toContain('SECRET_TEST_KEY'); expect(captured.body.generationConfig.responseFormat.text.mimeType).toBe('APPLICATION_JSON'); }
  });
  test('context drops project text, arbitrary objects and private metadata', () => {
    const world = input(); world.scenarios[1].projects = [{ id: 'test', status: 'approved', name: 'SECRET_NAME', residents: 'SECRET_RESIDENTS', finance: { estimatedCost: 123, customerData: 'SECRET_FINANCE' } }];
    const context = buildProviderContext({ prompt: 'Edit', scenario: world.scenarios[1], selection: { kind: 'building', id: 'test', label: 'SECRET_LABEL', notes: 'SECRET_SELECTION' } });
    expect(JSON.stringify(context)).not.toContain('SECRET_');
    expect(context.data.scenario.projects[0].finance.estimatedCost).toBe(123);
  });
  test('arbitrary paths and evidence mutations from a provider are rejected', async () => {
    for (const operations of [[{ op: 'write_file', target: '/tmp/evil', value: 'code' }], [{ op: 'set_parameter', target: '__proto__', value: 1 }], [{ op: 'change_world_visual', target: 'evidence', value: 'invented' }]]) {
      await expect(proposeWorldEdit({ ...args(), provider: 'openai', env: envFor('openai'), prompt: 'Edit', fetchImpl: async () => vendorResponse('openai', envelope(operations)) })).rejects.toThrow('validation');
    }
  });
  test('vendor refusal, malformed output, oversized response and HTTP error never apply or leak bodies', async () => {
    const world = input(), before = JSON.stringify(world);
    for (const response of [Response.json({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }), Response.json({ output_text: 'not JSON' }), new Response('SECRET_UPSTREAM_BODY', { status: 401 }), new Response('x'.repeat(131073))]) {
      await expect(proposeWorldEdit({ ...args(world), provider: 'openai', env: envFor('openai'), prompt: 'Edit', fetchImpl: async () => response })).rejects.toThrow();
    }
    expect(JSON.stringify(world)).toBe(before);
    const api = createWorldEditApiHandler({ env: envFor('openai'), fetchImpl: async () => new Response('SECRET_UPSTREAM_BODY', { status: 401 }) });
    const response = await api(new Request('http://local/api/world-edits/propose', { method: 'POST', body: JSON.stringify({ prompt: 'Edit', provider: 'openai', input: world, scenarioId: world.scenarios[1].id }) }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('SECRET_');
  });
  test('deadline cancels even a noncooperative mocked fetch', async () => {
    await expect(proposeWorldEdit({ ...args(), provider: 'openai', env: envFor('openai'), prompt: 'Edit', timeoutMs: 10, fetchImpl: () => new Promise(() => {}) })).rejects.toThrow('timed out');
  });
  test('remote proposal budget limits concurrency and per-client paid requests', async () => {
    const fetchImpl = async () => { await Bun.sleep(15); return vendorResponse('openai'); };
    const first = proposeWorldEdit({ ...args(), provider: 'openai', env: envFor('openai'), prompt: 'Edit', fetchImpl });
    const second = proposeWorldEdit({ ...args(), provider: 'openai', env: envFor('openai'), prompt: 'Edit', fetchImpl });
    await expect(proposeWorldEdit({ ...args(), provider: 'openai', env: envFor('openai'), prompt: 'Edit', fetchImpl })).rejects.toThrow('already running');
    await Promise.all([first, second]);
    let calls = 0;
    const api = createWorldEditApiHandler({ env: envFor('openai'), fetchImpl: async () => { calls++; return vendorResponse('openai'); } });
    const world = input();
    const request = () => new Request('http://local/api/world-edits/propose', { method: 'POST', body: JSON.stringify({ provider: 'openai', prompt: 'Edit', input: world, scenarioId: 'plan-a' }) });
    for (let index = 0; index < 10; index++) expect((await api(request())).status).toBe(200);
    expect((await api(request())).status).toBe(429); expect(calls).toBe(10);
  });
  test('API exposes configuration and proposal-only routes, with request bounds and origin checks', async () => {
    const api = createWorldEditApiHandler({ env: {} });
    expect((await api(new Request('http://local/api/world-edits/providers'))).status).toBe(200);
    const world = input(); const body = JSON.stringify({ prompt: 'Make construction capacity 20% higher', input: world, scenarioId: world.scenarios[1].id });
    const proposal = await api(new Request('http://local/api/world-edits/propose', { method: 'POST', body }));
    expect(proposal.status).toBe(200); expect((await proposal.json()).proposal.operations[0].value).toBe(86400);
    expect((await api(new Request('http://local/api/world-edits/propose', { method: 'POST', headers: { origin: 'http://evil' }, body }))).status).toBe(403);
    expect((await api(new Request('http://local/api/world-edits/propose', { method: 'POST', body: 'x'.repeat(262145) }))).status).toBe(413);
    expect((await api(new Request('http://local/api/world-edits/propose', { method: 'POST', body: '{' }))).status).toBe(400);
  });
});

test('ground wish preserves coordinates, exposes interpreted quantities and rejects impossible floors without clamping',async()=>{
 const world=input(),before=JSON.stringify(world);
 const proposal=await proposeWorldEdit({...args(world),selection:{kind:'district',id:'chosen',location:{x:333,z:444}},prompt:'Build a 24-story, 310-unit apartment tower here'});
 expect(proposal.operations[0].value.location).toMatchObject({x:333,z:444});
 expect(proposal.operations[0].value.geometry.floors).toBe(24);
 expect(proposal.warnings.join(' ')).toContain('No values were clamped');
 expect(proposal.warnings.join(' ')).toContain('utility capacity');
 await expect(proposeWorldEdit({...args(world),prompt:'Build a 200-story, 310-unit tower'})).rejects.toThrow('geometry.floors');
 expect(JSON.stringify(world)).toBe(before);
});
