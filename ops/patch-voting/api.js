// Server-only, persistent and deliberately advisory player voting.
// Votes can rank already-curated tasks; suggestions cannot execute as prompts.
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { approvedPatchCandidates } from './candidates.js';

const SESSION = 'hbl_patch_session';
const MAX_BODY = 2048;
const json = (data, status = 200, cookie = null) => Response.json(data, {
  status,
  headers: {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(cookie ? { 'set-cookie': cookie } : {})
  }
});
function error(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
function validString(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min &&
    value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
function sign(secret, token) {
  return createHmac('sha256', secret).update('session:' + token).digest('hex');
}
function identity(secret, token) {
  return createHmac('sha256', secret).update('voter:' + token).digest('hex');
}
function getSession(request, secret) {
  if (!secret) return null;
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)hbl_patch_session=([0-9a-f]{48})\.([0-9a-f]{64})(?:;|$)/);
  if (!match) return null;
  const expected = Buffer.from(sign(secret, match[1]), 'hex');
  const received = Buffer.from(match[2], 'hex');
  return timingSafeEqual(expected, received) ? match[1] : null;
}
function cookieHeader(token, secret, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return SESSION + '=' + token + '.' + sign(secret, token) +
    '; HttpOnly; Path=/api/patch-votes; SameSite=Strict; Max-Age=7776000' + secure;
}
async function readBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw error(415, 'Send application/json.');
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) throw error(413, 'Request is too large.');
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY) throw error(413, 'Request is too large.');
  try {
    const data = JSON.parse(raw);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('not object');
    return data;
  } catch {
    throw error(400, 'Invalid JSON object.');
  }
}
function sameOrigin(request) {
  const url = new URL(request.url);
  return request.headers.get('origin') === url.origin;
}

export function createPatchVotingStore(options = {}) {
  const dbPath = options.dbPath || process.env.HBL_PATCH_VOTE_DB_PATH || resolve('.hbl-private/patch-votes.sqlite');
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new Database(dbPath, { create: true });
  db.exec('PRAGMA busy_timeout=2500');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode=WAL');
  db.exec([
    'CREATE TABLE IF NOT EXISTS ballot (id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL, cadence TEXT NOT NULL, area TEXT NOT NULL, closes_at INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS vote (candidate_id TEXT NOT NULL, voter_key TEXT NOT NULL, value INTEGER NOT NULL CHECK(value IN (-1,1)), updated_at INTEGER NOT NULL, PRIMARY KEY(candidate_id,voter_key))',
    'CREATE TABLE IF NOT EXISTS suggestion (id TEXT PRIMARY KEY, voter_key TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT \'pending\')',
    'CREATE TABLE IF NOT EXISTS throttle (voter_key TEXT NOT NULL, action TEXT NOT NULL, at INTEGER NOT NULL)'
  ].join(';') + ';');
  const clock = options.now || (() => Date.now());
  const initial = clock();
  const seed = db.query('INSERT OR IGNORE INTO ballot (id,title,summary,cadence,area,closes_at) VALUES (?,?,?,?,?,?)');
  for (const item of approvedPatchCandidates) {
    seed.run(item.id, item.title, item.summary, item.cadence, item.area, initial + (item.cadence === 'daily' ? 1 : 7) * 86400000);
  }
  const getCandidate = db.query('SELECT * FROM ballot WHERE id=?');
  const tally = db.query('SELECT COALESCE(SUM(value),0) AS score, COUNT(*) AS votes, SUM(CASE WHEN value=1 THEN 1 ELSE 0 END) AS upvotes FROM vote WHERE candidate_id=?');
  const own = db.query('SELECT value FROM vote WHERE candidate_id=? AND voter_key=?');
  const list = (voterKey = '') => db.query('SELECT * FROM ballot ORDER BY closes_at, id').all().map(item => ({
    id: item.id, title: item.title, summary: item.summary, cadence: item.cadence, area: item.area,
    closesAt: new Date(item.closes_at).toISOString(), open: clock() < item.closes_at,
    ...tally.get(item.id), yourVote: own.get(item.id, voterKey)?.value || 0
  }));
  function throttle(key, action, limit, windowMs) {
    const ts = clock();
    db.query('DELETE FROM throttle WHERE at < ?').run(ts - 86400000);
    const n = db.query('SELECT COUNT(*) AS n FROM throttle WHERE voter_key=? AND action=? AND at>=?').get(key, action, ts - windowMs).n;
    if (n >= limit) throw error(429, 'Too many requests. Try again later.');
    db.query('INSERT INTO throttle (voter_key,action,at) VALUES (?,?,?)').run(key, action, ts);
  }
  const castVote = db.transaction((id, voterKey, value) => {
    const item = getCandidate.get(id);
    if (!item) throw error(404, 'Patch not found.');
    if (clock() >= item.closes_at) throw error(409, 'Voting is closed for this patch.');
    if (![1, -1, 0].includes(value)) throw error(400, 'Vote must be 1, -1, or 0.');
    if (own.get(id, voterKey)?.value === value) return;
    throttle(voterKey, 'vote', 24, 3600000);
    if (value === 0) db.query('DELETE FROM vote WHERE candidate_id=? AND voter_key=?').run(id, voterKey);
    else db.query('INSERT INTO vote (candidate_id,voter_key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(candidate_id,voter_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(id, voterKey, value, clock());
  });
  const suggest = db.transaction((voterKey, title, details) => {
    if (!validString(title, 8, 100) || !validString(details, 12, 800)) throw error(400, 'Title must be 8–100 characters and details 12–800 characters.');
    throttle(voterKey, 'suggest', 3, 86400000);
    const id = randomUUID();
    db.query('INSERT INTO suggestion (id,voter_key,title,details,created_at,status) VALUES (?,?,?,?,?,?)').run(id, voterKey, title.trim(), details.trim(), clock(), 'pending');
    return { id, status: 'pending' };
  });
  return {
    list, castVote, suggest,
    listSuggestions: () => db.query('SELECT id,title,details,created_at,status FROM suggestion ORDER BY created_at DESC LIMIT 200').all(),
    close: () => db.close()
  };
}

export function createPatchVotingHandler(options = {}) {
  const secret = options.secret ?? process.env.HBL_PATCH_VOTE_SECRET;
  const store = options.store || createPatchVotingStore(options);
  async function handle(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, '');
    let token = secret ? getSession(request, secret) : null;
    const fresh = Boolean(secret && !token);
    if (fresh) token = randomBytes(24).toString('hex');
    const setCookie = fresh ? cookieHeader(token, secret, request) : null;
    const voterKey = token ? identity(secret, token) : '';
    try {
      if (pathname === '/api/patch-votes' && request.method === 'GET') {
        return json({ schemaVersion: 'patch-ballot.v1', advisory: true, patches: store.list(voterKey), submissionsRequireReview: true, votingEnabled: Boolean(secret) }, 200, setCookie);
      }
      if (request.method !== 'POST') return json({ error: 'Not found.' }, 404, setCookie);
      if (!secret) throw error(503, 'Patch voting is not configured on this server.');
      if (!sameOrigin(request)) throw error(403, 'Same-origin request required.');
      const match = pathname.match(/^\/api\/patch-votes\/([A-Za-z0-9_-]{1,32})\/vote$/);
      if (match) {
        const body = await readBody(request);
        if (Object.keys(body).some(key => key !== 'value')) throw error(400, 'Only value is accepted.');
        store.castVote(match[1], voterKey, body.value);
        return json({ patches: store.list(voterKey) }, 200, setCookie);
      }
      if (pathname === '/api/patch-votes/suggestions') {
        const body = await readBody(request);
        if (Object.keys(body).some(key => !['title', 'details'].includes(key))) throw error(400, 'Unexpected suggestion field.');
        return json({ message: 'Suggestion sent for moderation; it is not an agent instruction.', ...store.suggest(voterKey, body.title, body.details) }, 202, setCookie);
      }
      return json({ error: 'Not found.' }, 404, setCookie);
    } catch (e) {
      return json({ error: e.message || 'Patch voting unavailable.' }, e.status || 500, setCookie);
    }
  }
  handle.close = () => store.close();
  handle.store = store;
  return handle;
}
