import { test, expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createPatchVotingHandler } from '../ops/patch-voting/api.js';
import { createPatchGithubWebhookHandler } from '../ops/patch-voting/github-webhook.js';
import { verifyRunArtifact } from '../ops/patch-voting/import-impact.mjs';
import { createHash } from 'node:crypto';

const repo = 'adnanwahab/happybearlandia';
const sha = 'a'.repeat(40);
const webhookSecret = 'a-secret-long-enough-for-real-webhook-tests';
const impact = {
  schemaVersion: 'hbl.patch-impact.v1', candidateId: 'U06',
  seed: '1234', startingStateId: 'start:1', scenarioId: 'scenario:hbl:baseline',
  recordedAt: '2026-11-17T20:00:00Z',
  before: { runId: 'base-run', source: 'recorded', modelVersion: 'city-v1', rulesVersion: 'rules-v1',
    evidenceSha256: 'b'.repeat(64), metrics: [{ key: 'rent', label: 'Monthly rent', value: 500, unit: 'USD/month' }] },
  after: { runId: 'patch-run', source: 'recorded', modelVersion: 'city-v1', rulesVersion: 'rules-v2',
    evidenceSha256: 'c'.repeat(64), metrics: [{ key: 'rent', label: 'Monthly rent', value: 450, unit: 'USD/month' }] }
};
function webhookRequest(data, { event = 'pull_request', sign = true } = {}) {
  const body = JSON.stringify(data);
  const headers = { 'content-type': 'application/json', 'x-github-event': event };
  if (sign) headers['x-hub-signature-256'] = 'sha256=' + createHmac('sha256', webhookSecret).update(body).digest('hex');
  return new Request('https://hbl.example/webhooks/github', { method:'POST', headers, body });
}
function prEvent({ number = 42, state = 'open', draft = false, merged = false, headSha = sha } = {}) {
  return { repository: { full_name:repo }, action: merged ? 'closed' : 'ready_for_review',
    pull_request: { number, state, draft, merged,
      head: { sha: headSha, repo: { full_name:repo } }, base: { repo: { full_name:repo } } } };
}

test('public patch API lists curated ballots and does not publish private suggestions', async () => {
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret:'secret-for-test' });
  try {
    const listed = await h(new Request('https://hbl.example/api/patches'));
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.schemaVersion).toBe('hbl.patches.v1');
    expect(body.patches.find(x=>x.id==='U06').github).toBeNull();
    expect(body.patches.find(x=>x.id==='U06').impactAvailable).toBe(false);
    expect((await h(new Request('https://hbl.example/api/patches/NOTKNOWN/impact'))).status).toBe(404);
    const missing = await h(new Request('https://hbl.example/api/patches/U06/impact'));
    expect((await missing.json()).available).toBe(false);
  } finally { h.close(); }
});

test('impact requires matching recorded metrics, origin state, and provenance', async () => {
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret:'' });
  try {
    expect(h.store.setImpact('U06', impact).metrics[0].delta).toBe(-50);
    const response = await h(new Request('https://hbl.example/api/patches/U06/impact'));
    expect(response.status).toBe(200);
    expect((await response.json()).metrics[0]).toMatchObject({ before:500, after:450, delta:-50 });
    expect(h.store.list().find(x=>x.id==='U06').impactAvailable).toBe(true);
    expect(() => h.store.setImpact('BAD',impact)).toThrow();
    expect(() => h.store.setImpact('U06',{ ...impact, after:{ ...impact.after, source:'estimated' } })).toThrow();
    expect(() => h.store.setImpact('U06',{ ...impact, after:{ ...impact.after, metrics:[{key:'rent',label:'Rent',value:450,unit:'km'}] } })).toThrow();
  } finally { h.close(); }
});

test('import verifier rejects fabricated digests and altered run content', () => {
  const raw = Buffer.from(JSON.stringify({schemaVersion:'hbl.sim-run.v1', seed:'1234', scenarioId:impact.scenarioId, startingStateId:impact.startingStateId,
    runId:impact.before.runId, modelVersion:impact.before.modelVersion, rulesVersion:impact.before.rulesVersion, metrics:impact.before.metrics}));
  const record = { ...impact.before, evidenceSha256:createHash('sha256').update(raw).digest('hex') };
  expect(() => verifyRunArtifact(raw, record, impact)).not.toThrow();
  expect(() => verifyRunArtifact(Buffer.from(raw.toString()+' '), record, impact)).toThrow();
  expect(() => verifyRunArtifact(raw, {...record, metrics:[{ ...record.metrics[0],value:1 }]}, impact)).toThrow();
});

test('GitHub patch webhook is signature and identity checked and merges are monotonic', async () => {
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret:'' });
  try {
    h.store.linkGithub('U06', { prNumber:42, prUrl:'https://github.com/adnanwahab/happybearlandia/pull/42', headSha:sha, status:'draft' });
    const handler = createPatchGithubWebhookHandler({store:h.store,secret:webhookSecret});
    const bad = await handler(webhookRequest(prEvent(),{sign:false}));
    expect(bad.status).toBe(401);
    expect(h.store.list().find(x=>x.id==='U06').github.status).toBe('draft');
    const wrong = await handler(webhookRequest({...prEvent(),repository:{full_name:'someone/else'}}));
    expect(wrong.status).toBe(202);
    const opened = await handler(webhookRequest(prEvent()));
    expect(opened.status).toBe(200);
    expect(h.store.list().find(x=>x.id==='U06').github.status).toBe('open');
    const merged = await handler(webhookRequest(prEvent({state:'closed',merged:true})));
    expect(merged.status).toBe(200);
    expect(h.store.list().find(x=>x.id==='U06').github.status).toBe('merged');
    await handler(webhookRequest(prEvent({state:'open'})));
    expect(h.store.list().find(x=>x.id==='U06').github.status).toBe('merged');
    expect((await handler(webhookRequest(prEvent({number:777})))).status).toBe(200);
  } finally { h.close(); }
});

test('private player suggestions may retain only validated scenario IDs', async () => {
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret:'secret-for-test' });
  try {
    const submitted=h.store.suggest('voter','Please add crosswalks','Crosswalks should appear at busy transit stops.','idea',null,
      {universeId:'universe:hbl:main',worldId:'world:hbl:main',scenarioId:'scenario:hbl:baseline'});
    expect(submitted.status).toBe('pending');
    expect(JSON.parse(h.store.listSuggestions()[0].world_context).worldId).toBe('world:hbl:main');
    expect(() => h.store.suggest('voter','Please add crosswalks','Crosswalks should appear at busy transit stops.','idea',null,
      {webhook:'https://evil.test'})).toThrow();
  } finally { h.close(); }
});
