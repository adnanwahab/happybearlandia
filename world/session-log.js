import { createFirstPlaySessionId } from './first-play-events.js';

export const SESSION_LOG_KEY = 'hbl.play-sessions.v1';
export const SESSION_CONSENT_KEY = 'hbl.play-session-consent.v1';
export const SESSION_TTL_MS = 7 * 86400000;
export const MAX_SESSIONS = 5;
export const MAX_EVENTS = 1800;
const MAX_DURATION = 30 * 60 * 1000;
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const round = n => Math.round(n * 10) / 10;
const vector = value => Array.isArray(value) && value.length === 3 && value.every(n => finite(n, -1e7, 1e7)) ? value.map(round) : null;

// Construct closed records. Never retain labels, values, URLs, stack traces,
// resident identities, raw errors, or arbitrary data from DOM/storage callers.
export function sanitizeSessionEvent(input) {
  if (!input || !finite(input.at, 0, MAX_DURATION)) return null;
  const event = { at: Math.round(input.at), type: input.type };
  if (input.type === 'sample') {
    event.minute = finite(input.minute, 0, 1e10) ? round(input.minute) : null;
    event.seed = Number.isInteger(input.seed) && finite(input.seed, 0, 0xffffffff) ? input.seed : null;
    event.fps = finite(input.fps, 0, 1000) ? round(input.fps) : null;
    event.maxFrameMs = finite(input.maxFrameMs, 0, MAX_DURATION) ? round(input.maxFrameMs) : null;
    event.camera = vector(input.camera);
    event.target = vector(input.target);
    event.mode = ['legacy', 'living'].includes(input.mode) ? input.mode : 'unknown';
  } else if (input.type === 'click') {
    event.kind = ['button', 'link', 'canvas', 'input', 'other'].includes(input.kind) ? input.kind : 'other';
    event.x = finite(input.x, 0, 1) ? Math.round(input.x * 100) / 100 : null;
    event.y = finite(input.y, 0, 1) ? Math.round(input.y * 100) / 100 : null;
  } else if (input.type === 'error') {
    event.kind = ['javascript', 'rejection', 'resource'].includes(input.kind) ? input.kind : 'javascript';
  } else return null;
  return event;
}

export function sanitizeSession(input, now = Date.now()) {
  if (!input || input.version !== 1 || !/^fps_[0-9a-f]{32}$/.test(input.id) ||
      !finite(input.startedAt, now - SESSION_TTL_MS, now) || !Array.isArray(input.events)) return null;
  const events = input.events.slice(0, MAX_EVENTS).map(sanitizeSessionEvent).filter(Boolean).sort((a, b) => a.at - b.at);
  return { version: 1, id: input.id, startedAt: input.startedAt, events };
}

export function readSessions(storage, now = Date.now()) {
  try {
    const serialized = storage.getItem(SESSION_LOG_KEY) || '[]';
    if (serialized.length > 2_000_000) throw Error('oversized local log');
    const raw = JSON.parse(serialized);
    const sessions = Array.isArray(raw) ? raw.slice(-MAX_SESSIONS).map(s => sanitizeSession(s, now)).filter(Boolean) : [];
    storage.setItem(SESSION_LOG_KEY, JSON.stringify(sessions)); // prune expired/tampered records on access
    return sessions;
  } catch { try { storage.removeItem(SESSION_LOG_KEY); } catch {} return []; }
}

export function hasSessionConsent(storage) {
  try { return storage.getItem(SESSION_CONSENT_KEY) === 'yes'; } catch { return false; }
}

export function setSessionConsent(storage, enabled) {
  try {
    if (!enabled) storage.removeItem(SESSION_LOG_KEY);
    storage.setItem(SESSION_CONSENT_KEY, enabled ? 'yes' : 'no');
    return true;
  } catch { return false; }
}

export function createSessionRecorder({ storage, now = Date.now, elapsed = () => performance.now(), id = createFirstPlaySessionId }) {
  let current = null, start = 0, lastSaved = -Infinity;
  function permitted() { return hasSessionConsent(storage); }
  function flush() {
    if (!current || !permitted()) { current = null; return false; }
    const safe = sanitizeSession(current, now());
    if (!safe) return false;
    try {
      const sessions = readSessions(storage, now()).filter(s => s.id !== safe.id);
      storage.setItem(SESSION_LOG_KEY, JSON.stringify([...sessions, safe].slice(-MAX_SESSIONS)));
      lastSaved = elapsed();
      return true;
    } catch { return false; }
  }
  return {
    record(input) {
      if (!permitted()) { current = null; return false; }
      if (!current) {
        try { current = { version: 1, id: id(), startedAt: now(), events: [] }; start = elapsed(); }
        catch { return false; } // No insecure ID fallback; diagnostics must not break play.
      }
      const at = elapsed() - start;
      if (at > MAX_DURATION || current.events.length >= MAX_EVENTS) return false;
      const event = sanitizeSessionEvent({ ...input, at });
      if (!event) return false;
      current.events.push(event);
      if (elapsed() - lastSaved >= 5000) flush();
      return true;
    },
    flush,
    revoke() { current = null; return setSessionConsent(storage, false); },
  };
}

export function sessionFrameAt(session, at) {
  const events = session.events.filter(e => e.at <= at);
  return { sample: events.findLast(e => e.type === 'sample') ?? null, recent: events.slice(-8) };
}
