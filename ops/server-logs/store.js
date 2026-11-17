import { appendFileSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const DEFAULT_LOG_DIR = '.hbl-private/server-logs';
export const MAX_READ_BYTES = 64 * 1024 * 1024;
const DAY_MS = 86400000;
const FILE = /^server-(\d{4}-\d{2}-\d{2})\.jsonl$/;
// Directories served as static files. Raw log files must never be reachable there.
const PUBLIC_ROOTS = ['data', 'world', 'game', 'tools', 'blog', 'visualizations', 'web', 'shared'];

const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isInteger(number)
    ? Math.min(max, Math.max(min, number)) : fallback;
};
const dayOf = ms => new Date(ms).toISOString().slice(0, 10);

export function resolveLogDir(dir = DEFAULT_LOG_DIR) {
  const absolute = resolve(dir);
  for (const root of PUBLIC_ROOTS) {
    const rel = relative(resolve(root), absolute);
    if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep)) {
      throw new Error('Server log directory must be outside public static directories.');
    }
  }
  return absolute;
}

// Append-only JSON lines, one file per UTC day. Writes are synchronous so an entry
// is on disk before the response is sent, and failures never reach the caller.
export function createServerLogStore(options = {}) {
  const dir = resolveLogDir(options.dir || DEFAULT_LOG_DIR);
  const now = options.now || Date.now;
  const retentionDays = clampInt(options.retentionDays, 1, 90, 14);
  const maxBytesPerDay = clampInt(options.maxBytesPerDay, 1024, 1024 * 1024 * 1024, 20 * 1024 * 1024);
  let prepared = false;
  let day = null;
  let bytes = 0;
  let capped = false;
  let dropped = 0;
  const fileFor = name => join(dir, `server-${name}.jsonl`);

  function prune(at = now()) {
    const oldest = dayOf(at - (retentionDays - 1) * DAY_MS);
    let names = [];
    try { names = readdirSync(dir); } catch { return 0; }
    let removed = 0;
    for (const name of names) {
      const match = FILE.exec(name);
      if (!match || match[1] >= oldest) continue;
      try { unlinkSync(join(dir, name)); removed++; } catch {}
    }
    return removed;
  }

  function append(line) {
    appendFileSync(fileFor(day), line);
    bytes += Buffer.byteLength(line);
  }

  function record(entry) {
    try {
      const at = now();
      if (!prepared) {
        mkdirSync(dir, { recursive: true });
        prepared = true;
      }
      const today = dayOf(at);
      if (today !== day) {
        day = today;
        capped = false;
        try { bytes = statSync(fileFor(day)).size; } catch { bytes = 0; }
        prune(at);
      }
      const t = new Date(at).toISOString();
      const line = JSON.stringify({ t, ...entry }) + '\n';
      if (bytes + Buffer.byteLength(line) > maxBytesPerDay) {
        dropped++;
        if (!capped) {
          capped = true;
          append(JSON.stringify({ t, level: 'warn', type: 'notice',
            message: 'Daily server log size limit reached; later entries today were dropped.' }) + '\n');
        }
        return false;
      }
      append(line);
      return true;
    } catch {
      dropped++;
      return false;
    }
  }

  // Entries between since and until, newest first. Stops before reading more than
  // MAX_READ_BYTES and reports truncation so the caller can narrow the window.
  function read({ since, until = now() } = {}) {
    let names = [];
    try { names = readdirSync(dir); } catch { return { entries: [], truncated: false }; }
    const first = dayOf(since);
    const last = dayOf(until);
    const days = names.map(name => FILE.exec(name)?.[1]).filter(name => name && name >= first && name <= last).sort().reverse();
    const entries = [];
    let total = 0;
    let truncated = false;
    for (const name of days) {
      let text;
      try {
        const size = statSync(fileFor(name)).size;
        if (total + size > MAX_READ_BYTES) {
          truncated = true;
          break;
        }
        total += size;
        text = readFileSync(fileFor(name), 'utf8');
      } catch {
        continue;
      }
      const lines = text.split('\n');
      for (let index = lines.length - 1; index >= 0; index--) {
        if (!lines[index]) continue;
        let entry;
        try { entry = JSON.parse(lines[index]); } catch { continue; }
        const at = Date.parse(entry?.t);
        if (Number.isFinite(at) && at >= since && at <= until) entries.push(entry);
      }
    }
    return { entries, truncated };
  }

  return { dir, retentionDays, record, read, prune, stats: () => ({ dropped, retentionDays, maxBytesPerDay }) };
}
