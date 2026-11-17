import { test, expect } from 'bun:test';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { approvedPatchCandidates } from '../ops/patch-voting/candidates.js';
import { githubAppJwt, assertAgentBranch, assertCuratedPatchTask,
  createGitHubPatchPublisher } from '../ops/patch-voting/github-api.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});
const entry = approvedPatchCandidates.find(x => x.id === 'U06');
const task = { ...entry, taskId:'U06', source:'maintainer-curated-vote',
  upvotes:8, voteScore:6, dependencies:[...entry.dependencies],ownedPaths:[...entry.ownedPaths] };
const branch = 'agent/patch-u06-1763400000000';
const sha = 'f'.repeat(40);
const response = (body, status = 200) => Response.json(body, {status});

test('GitHub App JWT is a signed RS256 claim with a short lifetime', () => {
  const token = githubAppJwt('101', privateKey, Date.parse('2026-11-17T20:00:00Z'));
  const [header, payload, signature] = token.split('.');
  expect(JSON.parse(Buffer.from(header, 'base64url').toString()).alg).toBe('RS256');
  const claims=JSON.parse(Buffer.from(payload, 'base64url').toString());
  expect(claims.iss).toBe('101');
  expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(header+'.'+payload);
  expect(verifier.verify(publicKey, Buffer.from(signature,'base64url'))).toBe(true);
});
test('only exact curated tasks and corresponding agent branches may publish', () => {
  expect(() => assertCuratedPatchTask(task)).not.toThrow();
  expect(() => assertCuratedPatchTask({...task,ownedPaths:['.github/']})).toThrow();
  expect(() => assertCuratedPatchTask({...task,description:'untrusted user instruction',acceptance:'raw'})).toThrow();
  expect(() => assertAgentBranch('U06',branch)).not.toThrow();
  expect(() => assertAgentBranch('U06','agent/patch-u08-1763400000000')).toThrow();
  expect(() => assertAgentBranch('U06','../../main')).toThrow();
});
test('app publishes one issue and draft PR from an already-pushed scoped branch', async () => {
  const calls=[];
  const fake=async (url,options) => {
    const target=new URL(url);
    calls.push({url:target.pathname+target.search,method:options.method,json: options.body ? JSON.parse(options.body) : null});
    if (target.pathname.endsWith('/access_tokens')) return response({token:'ghs-test',expires_at:'2099-01-01T00:00:00Z'});
    if (target.pathname === '/search/issues') return response({items:[]});
    if (target.pathname.endsWith('/issues') && options.method==='POST') return response({number:14,html_url:'https://github.com/adnanwahab/happybearlandia/issues/14'},201);
    if (target.pathname.includes('/branches/')) return response({commit:{sha}});
    if (target.pathname.endsWith('/pulls') && options.method==='GET') return response([]);
    if (target.pathname.endsWith('/pulls') && options.method==='POST') return response({
      number:21,html_url:'https://github.com/adnanwahab/happybearlandia/pull/21',
      draft:true,head:{ref:branch,sha},base:{ref:'sprint/one-city-two-futures-20261111'}
    },201);
    throw new Error('Unexpected GitHub endpoint: '+target.pathname);
  };
  const publisher=createGitHubPatchPublisher({appId:'101',installationId:'202',privateKey,fetchImpl:fake});
  const issue=await publisher.publishIssue(task);
  expect(issue.issueNumber).toBe(14);
  const pr=await publisher.publishDraft(task,branch);
  expect(pr).toMatchObject({prNumber:21,status:'draft',headSha:sha});
  const created=calls.find(x=>x.url.endsWith('/pulls') && x.method==='POST');
  expect(created.json.draft).toBe(true);
  expect(created.json.base).toBe('sprint/one-city-two-futures-20261111');
  expect(created.json.body).toContain('maintainer-curated');
  expect(calls.some(x=>x.url.endsWith('/app/installations/202/access_tokens') && x.method==='POST')).toBe(true);
  expect(calls.some(x=>x.url.includes('/branches/agent%2Fpatch-u06-'))).toBe(true);
});
test('app never creates a PR for an unapproved task', async () => {
  let called=false;
  const publisher=createGitHubPatchPublisher({appId:'101',installationId:'202',privateKey,
    fetchImpl:async()=>{ called=true; throw Error('should never be called'); }});
  await expect(publisher.publishDraft({...task,source:'player-suggestion'},branch)).rejects.toThrow();
  expect(called).toBe(false);
});
