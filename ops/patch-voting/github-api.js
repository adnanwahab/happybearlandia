// GitHub App publisher for already-curated, closed-ballot patches.
// Run on a trusted agent host, never in the WebGPU browser or public vote handler.
import { createSign } from 'node:crypto';
import { approvedPatchCandidates } from './candidates.js';

export const PATCH_REPOSITORY = 'adnanwahab/happybearlandia';
export const PATCH_BASE = 'sprint/one-city-two-futures-20261111';
const API = 'https://api.github.com';

function base64url(value) { return Buffer.from(value).toString('base64url'); }
export function githubAppJwt(appId, privateKey, now = Date.now()) {
  if (!/^\d+$/.test(String(appId || '')) || !String(privateKey || '').includes('PRIVATE KEY')) throw new Error('GitHub App credentials are missing.');
  const issued = Math.floor(now / 1000) - 60;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: issued, exp: issued + 540, iss: String(appId) }));
  const unsigned = header + '.' + payload;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  return unsigned + '.' + signer.sign(String(privateKey).replace(/\\n/g, '\n')).toString('base64url');
}
function reject(text) { throw new Error(text); }
export function assertCuratedPatchTask(task) {
  const entry = approvedPatchCandidates.find(x => x.id === task?.taskId);
  if (!entry || task.source !== 'maintainer-curated-vote' ||
      task.acceptance !== entry.acceptance ||
      JSON.stringify(task.ownedPaths) !== JSON.stringify(entry.ownedPaths) ||
      JSON.stringify(task.dependencies) !== JSON.stringify(entry.dependencies)) {
    reject('Only an approved, unchanged, curated queue task may be published.');
  }
  return entry;
}
export function assertAgentBranch(taskId, branch) {
  const escaped = taskId.toLowerCase();
  if (typeof branch !== 'string' || !new RegExp('^agent/patch-' + escaped + '-[0-9]{10,16}$').test(branch)) {
    reject('Branch must be the verified agent branch for this voted task.');
  }
}
export function createGitHubPatchPublisher(options = {}) {
  const appId = options.appId ?? process.env.HBL_GITHUB_APP_ID;
  const installationId = options.installationId ?? process.env.HBL_GITHUB_INSTALLATION_ID;
  const privateKey = options.privateKey ?? process.env.HBL_GITHUB_APP_PRIVATE_KEY;
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => Date.now());
  if (!/^\d+$/.test(String(installationId || ''))) reject('GitHub App installation ID is missing.');
  let cached = null;
  async function request(path, { method = 'GET', json, token, app = false } = {}) {
    if (!path.startsWith('/') || path.startsWith('//')) reject('Invalid GitHub API path.');
    const response = await fetchImpl(API + path, {
      method, redirect: 'error',
      headers: { 'accept': 'application/vnd.github+json', 'x-github-api-version': '2026-03-10',
        'user-agent': 'happybearlandia-voted-patches',
        'authorization': 'Bearer ' + (app ? githubAppJwt(appId, privateKey, now()) : (token || await installationToken())),
        ...(json ? { 'content-type': 'application/json' } : {}) },
      ...(json ? { body: JSON.stringify(json) } : {})
    });
    if (!response.ok) throw new Error('GitHub ' + method + ' ' + path.split('?')[0] + ' failed with HTTP ' + response.status);
    if (response.status === 204) return null;
    return response.json();
  }
  async function installationToken() {
    if (cached && cached.until > now() + 60000) return cached.value;
    const result = await request('/app/installations/' + installationId + '/access_tokens', {
      method: 'POST', app: true,
      json: { repositories: ['happybearlandia'] }
    });
    if (typeof result?.token !== 'string' || !result.token) reject('GitHub returned no installation token.');
    cached = { value: result.token, until: Date.parse(result.expires_at) || now() + 300000 };
    return cached.value;
  }
  const repoApi = '/repos/' + PATCH_REPOSITORY;
  async function publishIssue(task) {
    assertCuratedPatchTask(task);
    const marker = '<!-- hbl-voted-patch:' + task.taskId + ' -->';
    const q = 'repo:' + PATCH_REPOSITORY + ' is:issue in:body "hbl-voted-patch:' + task.taskId + '"';
    const matches = await request('/search/issues?q=' + encodeURIComponent(q));
    const prior = (matches.items || []).find(x => x.body?.includes(marker) && !x.pull_request);
    if (prior) return { issueNumber: prior.number, issueUrl: prior.html_url, reused: true };
    const body = [
      marker, 'Community-approved candidate, not a raw player prompt.',
      'Task: ' + task.taskId,
      'Voting: ' + task.upvotes + ' upvotes, ' + task.voteScore + ' net votes on a closed ballot.',
      'Scope: ' + task.description,
      'Acceptance: ' + task.acceptance,
      'Dependencies: ' + task.dependencies.join(', '),
      'Allowed files: ' + task.ownedPaths.join(', '),
      'Checks: ' + task.verification.join('; '),
      'Implementation runs in an isolated, supervised agent worktree. PR review and CI are required.'
    ].join('\n\n');
    const created = await request(repoApi + '/issues', { method: 'POST', json: { title: '[voted patch] ' + task.taskId + ': ' + task.title, body } });
    return { issueNumber: created.number, issueUrl: created.html_url, reused: false };
  }
  async function publishDraft(task, branch) {
    assertCuratedPatchTask(task);
    assertAgentBranch(task.taskId, branch);
    // The coding agent must push the branch after local tests and scope checks.
    const head = await request(repoApi + '/branches/' + encodeURIComponent(branch));
    const sha = head?.commit?.sha;
    if (!/^[a-f0-9]{40}$/i.test(sha || '')) reject('GitHub branch head is unavailable.');
    const list = await request(repoApi + '/pulls?state=all&per_page=100&head=' + encodeURIComponent('adnanwahab:' + branch));
    let pr = list.find(x => x.head?.ref === branch && x.base?.ref === PATCH_BASE);
    if (!pr) {
      const body = [
        '<!-- hbl-voted-patch:' + task.taskId + ' -->',
        'Generated from a maintainer-curated, closed-ballot task. This is a draft until human review.',
        'Votes: ' + task.upvotes + ' upvotes, ' + task.voteScore + ' net.',
        'Acceptance: ' + task.acceptance,
        'Allowed paths: ' + task.ownedPaths.join(', '),
        'Focused checks: ' + task.verification.join('; '),
        'Review the exact head SHA, required checks, unresolved threads and deployment impact before marking ready.'
      ].join('\n\n');
      pr = await request(repoApi + '/pulls', { method: 'POST', json: {
        title: '[voted patch] ' + task.taskId + ': ' + task.title,
        body, head: branch, base: PATCH_BASE, draft: true, maintainer_can_modify: true
      } });
    }
    return { prNumber: pr.number, prUrl: pr.html_url, headSha: sha.toLowerCase(),
      status: pr.draft ? 'draft' : pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
      reused: Boolean(list.find(x => x.number === pr.number)) };
  }
  async function getStatus(number) {
    if (!Number.isSafeInteger(number) || number < 1) reject('Invalid PR number.');
    const pr = await request(repoApi + '/pulls/' + number);
    const checks = await request(repoApi + '/commits/' + pr.head.sha + '/check-runs?per_page=100');
    const runs = Array.isArray(checks?.check_runs) ? checks.check_runs : [];
    return { prNumber: pr.number, url: pr.html_url, headSha: pr.head.sha,
      status: pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state === 'closed' ? 'closed' : 'open',
      checks: { total: runs.length, passed: runs.filter(x => x.conclusion === 'success').length,
        failed: runs.filter(x => ['failure','cancelled','timed_out','action_required'].includes(x.conclusion)).length,
        pending: runs.filter(x => x.status !== 'completed').length } };
  }
  return { publishIssue, publishDraft, getStatus };
}
