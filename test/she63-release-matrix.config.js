import { defineConfig } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Separate from canonical suites and their owners. Never use personal saved data.
const store = mkdtempSync(join(tmpdir(), 'she63-matrix-'));
// The SHE-63 runner reserves an OS-selected free loopback port and sets
// HBL_SHE63_PORT. Direct Playwright invocations use a randomized fallback.
const port = process.env.HBL_SHE63_PORT || String(randomInt(35_000, 60_000));
const baseURL = `http://127.0.0.1:${port}`;
const artifacts = process.env.HBL_SHE63_ARTIFACT_DIR || join(tmpdir(), 'hbl-she63-matrix');
const bun = process.env.HBL_BUN_EXECUTABLE || 'bun';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['two-futures-sprint.e2e.js', 'two-futures-compatibility.e2e.js', 'future-machine-share-reliability.e2e.js'],
  grep: /real paired runs:|guided controls,|forced unavailable WebGL|320px Canvas comparison|actual saved replay retains/,
  workers: 1,
  timeout: 150000,
  expect: { timeout: 30000 },
  outputDir: join(artifacts, 'tests'),
  reporter: [['list'], ['json', { outputFile: join(artifacts, 'results.json') }]],
  use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: 'on', screenshot: 'only-on-failure' },
  // Firefox/WebKit require their matching Playwright builds. WebKit is not Safari.
  projects: [
    { name: 'installed-chrome', use: { browserName: 'chromium', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-swiftshader'] } } },
    { name: 'playwright-firefox', use: { browserName: 'firefox' } },
    { name: 'playwright-webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: `"${bun}" --no-env-file run server.js`, cwd: process.cwd(), url: baseURL,
    reuseExistingServer: false, timeout: 60000,
    env: { PORT: port, HBL_BIND_HOST: '127.0.0.1', HBL_GUEST_DB_PATH: join(store, 'guest.sqlite'), HBL_WORLD_DB_PATH: join(store, 'world.sqlite'), HBL_CITY_DATA_DIR: join(store, 'city'), HBL_REALITY_SHARE_DB_PATH: join(store, 'shares.sqlite'), DECISION_STORE_DIR: join(store, 'decision') },
  },
});
