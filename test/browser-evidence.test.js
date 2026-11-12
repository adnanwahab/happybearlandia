import { test, expect } from 'bun:test';
import { EventEmitter } from 'node:events';
import { collectBrowserEvidence, redact } from './helpers/browser-evidence.js';

function page() {
  const result = new EventEmitter();
  result.url = () => 'https://example.com/alice?token=private#email';
  return result;
}

test('errors, rejected promise pageerrors, network failures and context enter redacted attachment', async () => {
  const source = page();
  const collector = collectBrowserEvidence(source);
  source.emit('pageerror', new Error('exception alice@example.com'));
  source.emit('pageerror', new Error('Uncaught (in promise) token=private'));
  source.emit('console', { type: () => 'error', text: () => 'password=private' });
  source.emit('requestfailed', { url: source.url, failure: () => ({ errorText: 'failed' }) });
  source.emit('response', { url: source.url, status: () => 503 });
  let artifact;
  await collector.attach({ status: 'failed', attach: async (name, data) => {
    expect(name).toBe('browser-errors');
    expect(data.contentType).toBe('application/json');
    artifact = JSON.parse(data.body);
  } });
  expect(artifact.events).toHaveLength(5);
  expect(artifact.status).toBe('failed');
  expect(JSON.stringify(artifact)).not.toMatch(/alice|private|#email/);
  expect(artifact.events[1].message).toContain('promise');
});

test('normal traffic stays empty, overflow is counted and listeners are removed', async () => {
  const source = page();
  const collector = collectBrowserEvidence(source, { limit: 1 });
  source.emit('console', { type: () => 'log' });
  source.emit('response', { status: () => 200 });
  expect(collector.events).toEqual([]);
  collector.record('test', 'one');
  collector.record('test', 'two');
  await collector.attach({ attach: async (_, data) => expect(JSON.parse(data.body).dropped).toBe(1) });
  collector.dispose();
  expect(source.eventNames()).toEqual([]);
});

test('redacts common personal and credential formats and bounds long errors', () => {
  const value = redact('Bearer abc.def /Users/alice/a /home/bob/a C:\\Users\\carol\\a +1 (555) 123-4567 api_key=private');
  expect(value).not.toMatch(/alice|bob|carol|555|private|abc/);
  expect(redact('a'.repeat(3000))).toHaveLength(2000);
});
