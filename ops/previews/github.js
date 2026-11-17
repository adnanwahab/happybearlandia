import {ghRead} from './gh-transport.js';
export const REPOSITORY = 'adnanwahab/happybearlandia';
export class PreviewError extends Error {
  constructor(message, status = 400, retryAfter = null) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
export const validSHA = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function pullNumber(value) {
  if (!/^[1-9]\d{0,7}$/.test(String(value))) throw new PreviewError('Invalid pull request number');
  return Number(value);
}
function normalize(pr) {
  if (!validSHA(pr.head?.sha)) throw new PreviewError('GitHub returned an unavailable revision', 502);
  return {number: pr.number, title: pr.title, body: pr.body || '', author: pr.user?.login || 'Unknown',
    status: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open',
    updatedAt: pr.updated_at, base: pr.base?.ref, head: pr.head?.ref, sha: pr.head.sha,
    url: `https://github.com/${REPOSITORY}/pull/${pr.number}`, checks: 'unknown'};
}
export class GitHubMetadata {
  constructor({token = process.env.HBL_GITHUB_READ_TOKEN, fetchImpl = process.env.HBL_GITHUB_TRANSPORT === 'gh' ? ghRead : fetch, now = Date.now} = {}) {
    this.token = token; this.fetch = fetchImpl; this.now = now; this.cache = new Map(); this.pending = new Map(); this.backoff = 0;
  }
  async request(path, fresh = false) {
    const key = path, cached = this.cache.get(key);
    if (!fresh && cached && cached.expires > this.now()) return structuredClone(cached.data);
    if (this.pending.has(key)) return structuredClone(await this.pending.get(key));
    if (this.backoff > this.now()) throw new PreviewError('GitHub rate limited. Retry after the displayed delay.', 429, Math.ceil((this.backoff - this.now()) / 1000));
    const work = (async () => {
      let response;
      try { response = await this.fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, {
        headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(this.token ? {Authorization: `Bearer ${this.token}`} : {}),
          ...(!fresh && cached?.etag ? {'If-None-Match': cached.etag} : {})}, signal: AbortSignal.timeout(10000), redirect: 'error'});
      } catch { throw new PreviewError('GitHub is unavailable. No preview was requested.', 502); }
      if (response.status === 304 && cached) { cached.expires = this.now() + 30000; return cached.data; }
      if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
        const seconds = Math.min(3600, Math.max(1, Number(response.headers.get('retry-after')) || Number(response.headers.get('x-ratelimit-reset')) - this.now()/1000 || 60));
        this.backoff = this.now() + seconds * 1000; throw new PreviewError('GitHub metadata rate limit reached.', 429, Math.ceil(seconds));
      }
      if (!response.ok) throw new PreviewError(response.status === 404 ? 'Pull request unavailable' : 'GitHub metadata request rejected; check read-only token configuration.', response.status === 404 ? 404 : 502);
      const data = await response.json();
      const result = {data, hasNext: /rel="next"/.test(response.headers.get('link') || '')};
      if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, {data: result, etag: response.headers.get('etag'), expires: this.now() + 30000}); return result;
    })();
    this.pending.set(key, work);
    try { return structuredClone(await work); } finally { this.pending.delete(key); }
  }
  async list(params = new URLSearchParams()) {
    if (params.has('state') && params.get('state') !== 'open') throw new PreviewError('Only open pull requests are supported.');
    const page = params.get('page') ?? '1';
    if (!/^[1-9]\d{0,4}$/.test(page)) throw new PreviewError('Invalid page');
    if (params.has('perPage') && params.get('perPage') !== '25') throw new PreviewError('Page size is fixed at 25');
    const result = await this.request(`/pulls?state=open&per_page=25&page=${page}&sort=updated&direction=desc`);
    if (!Array.isArray(result.data)) throw new PreviewError('Invalid GitHub list response', 502);
    return {repository: REPOSITORY, state: 'open', page: Number(page), perPage: 25, hasNext: result.hasNext, pulls: result.data.filter(p => p.state === 'open').map(normalize)};
  }
  async detail(number, fresh = false) { return normalize((await this.request(`/pulls/${pullNumber(number)}`, fresh)).data); }
}
