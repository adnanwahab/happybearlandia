import { Database } from 'bun:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
const moments = ['exploring', 'choosing', 'comparing', 'inspecting', 'sharing'];
const json = (body, status) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

// No individual records, identifiers, timestamps, or public read interface.
export function createPlayerFeedbackHandler({ directory = '.hbl-private/player-feedback' } = {}) {
  let db;
  return async request => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Same-origin request required' }, 403);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'JSON required' }, 415);
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Body required' }, 400);
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512) { await reader.cancel(); return json({ error: 'Body too large' }, 413); }
        chunks.push(value);
      }
      let data;
      try { data = JSON.parse(await new Blob(chunks).text()); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'consent,kind,moment,version' || data.version !== 1 || data.consent !== true || !['confusing', 'favorite'].includes(data.kind) || !moments.includes(data.moment)) return json({ error: 'Consented structured choices required' }, 400);
      if (!db) {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        chmodSync(directory, 0o700);
        const path = join(directory, 'counts.sqlite');
        const opened = new Database(path, { create: true });
        try {
          chmodSync(path, 0o600);
          opened.run('CREATE TABLE IF NOT EXISTS feedback_counts (kind TEXT, moment TEXT, count INTEGER NOT NULL, PRIMARY KEY(kind, moment))');
          db = opened;
        } catch (error) { opened.close(); throw error; }
      }
      db.query('INSERT INTO feedback_counts VALUES (?, ?, 1) ON CONFLICT(kind, moment) DO UPDATE SET count=count+1').run(data.kind, data.moment);
      return json({ ok: true }, 201);
    } catch { return json({ error: 'Feedback temporarily unavailable' }, 503); }
  };
}
