import { test, expect } from '@playwright/test';
import { collectBrowserEvidence, redact } from '../helpers/browser-evidence.js';

test('injected exceptions and promises produce redacted artifacts', async ({ page }) => {
  const collector = collectBrowserEvidence(page);
  await page.goto('about:blank');
  await page.evaluate(() => {
    setTimeout(() => { throw new Error('exception alice@example.com token=private'); });
    Promise.reject(new Error('promise https://example.com/private?password=private'));
  });
  await expect.poll(() => collector.events.length).toBe(2);
  const attachments = [];
  await collector.attach({ status: 'failed', attach: async (_, attachment) => attachments.push(JSON.parse(attachment.body)) });
  expect(attachments[0].events.map(event => event.message).join(' ')).toContain('exception');
  expect(attachments[0].events.map(event => event.message).join(' ')).toContain('promise');
  expect(JSON.stringify(attachments)).not.toMatch(/alice|private/);
  await collector.attach(test.info());
  collector.dispose();
});

test('clean run has no false errors and collection is bounded', async ({ page }) => {
  const collector = collectBrowserEvidence(page, { limit: 1 });
  await page.goto('about:blank');
  await page.evaluate(() => console.log('normal'));
  expect(collector.events).toEqual([]);
  await collector.attach(test.info());
  collector.record('test', 'one');
  collector.record('test', 'two');
  expect(collector.events).toHaveLength(1);
  collector.dispose();
  expect(redact('Bearer abc.def /Users/alice/file alice@example.com')).not.toMatch(/abc|alice/);
});
