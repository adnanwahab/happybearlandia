import { Database } from 'bun:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { validateSurvey } from '../../world/onboarding/session-survey-contract.js';
const json = (body, status) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export function createSessionSurveyHandler({ directory = '.hbl-private/session-survey' } = {}) {
  return async request => {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Same origin required.' }, 403);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({ error: 'JSON required.' }, 415);
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Body required.' }, 400);
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) { await reader.cancel(); return json({ error: 'Body too large.' }, 413); }
        chunks.push(value);
      }
      let data;
      try { data = validateSurvey(JSON.parse(await new Blob(chunks).text())); }
      catch { return json({ error: 'Invalid answers, missing consent, or contact details.' }, 400); }
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
      const path = join(directory, 'suggestions.sqlite');
      const db = new Database(path, { create: true });
      try {
        chmodSync(path, 0o600);
        db.run('CREATE TABLE IF NOT EXISTS suggestions (rating TEXT NOT NULL, suggestion TEXT NOT NULL)');
        db.query('INSERT INTO suggestions VALUES (?, ?)').run(data.rating, data.suggestion);
      } finally { db.close(); }
      return json({ ok: true }, 201);
    } catch { return json({ error: 'Feedback unavailable. Try again later.' }, 503); }
  };
}
