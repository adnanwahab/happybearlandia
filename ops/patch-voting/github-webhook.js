// Verify GitHub delivery signatures before updating the public PR lifecycle.
// No player input or GitHub webhook payload is executed as code.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PATCH_REPOSITORY } from './github-api.js';

const MAX_BYTES = 128 * 1024;
export function verifyGitHubSignature(raw, signature, secret) {
  if (!secret || typeof secret !== 'string' || secret.length < 32 ||
      typeof signature !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'), 'hex');
  const provided = Buffer.from(signature.slice(7), 'hex');
  return timingSafeEqual(expected, provided);
}
const reply = (data, status = 200) => Response.json(data, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
export function createPatchGithubWebhookHandler({ store, secret = process.env.HBL_GITHUB_WEBHOOK_SECRET } = {}) {
  if (!store || typeof store.updateGithub !== 'function') throw new Error('Patch store is required.');
  return async function handleGithubWebhook(request) {
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    if (!secret || secret.length < 32) return reply({ error: 'Webhook disabled.' }, 503);
    if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return reply({ error: 'Payload too large.' }, 413);
    // Read incrementally: malicious chunked requests must not allocate unbounded memory.
    const reader = request.body?.getReader();
    const chunks = [];
    let bytes = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
          await reader.cancel().catch(() => {});
          return reply({ error: 'Payload too large.' }, 413);
        }
        chunks.push(Buffer.from(value));
      }
    }
    const raw = Buffer.concat(chunks, bytes);
    if (!verifyGitHubSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
      return reply({ error: 'Invalid GitHub signature.' }, 401);
    }
    let data;
    try { data = JSON.parse(raw.toString('utf8')); }
    catch { return reply({ error: 'Invalid JSON.' }, 400); }
    if (data?.repository?.full_name !== PATCH_REPOSITORY) return reply({ accepted: false, reason: 'repository mismatch' }, 202);
    const githubEvent = request.headers.get('x-github-event');
    if (githubEvent === 'workflow_run') {
      const run = data.workflow_run;
      if (run?.name !== 'HappyBearLandia core journeys' ||
          !/^[a-f0-9]{40}$/i.test(run.head_sha || '') ||
          !Array.isArray(run.pull_requests)) return reply({ accepted: true, updated: false });
      const status = run.status !== 'completed' ? 'pending' :
        run.conclusion === 'success' ? 'success' : 'failure';
      let updated = false;
      for (const pr of run.pull_requests.slice(0, 50)) {
        updated = store.updateGithub(pr.number, { type: 'check', headSha: run.head_sha, status }) || updated;
      }
      return reply({ accepted: true, updated });
    }
    if (githubEvent !== 'pull_request') return reply({ accepted: true, updated: false });
    if (!['opened','reopened','ready_for_review','converted_to_draft','synchronize','closed'].includes(data.action)) return reply({ accepted: true, updated: false });
    const pr = data.pull_request;
    if (!Number.isSafeInteger(pr?.number) || pr.number < 1 ||
        pr.base?.repo?.full_name !== PATCH_REPOSITORY || pr.head?.repo?.full_name !== PATCH_REPOSITORY ||
        !/^[a-f0-9]{40}$/i.test(pr.head?.sha || '')) {
      return reply({ accepted: false, reason: 'pull request identity mismatch' }, 202);
    }
    const status = pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open';
    const updated = store.updateGithub(pr.number, { type: 'pull', headSha: pr.head.sha, status });
    return reply({ accepted: true, updated });
  };
}
