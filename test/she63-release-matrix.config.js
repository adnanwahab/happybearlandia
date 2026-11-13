import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Separate from canonical suites and their owners. Never use personal saved data.
const store = mkdtempSync(join(tmpdir(), 'she63-matrix-'));
const port = process.env.HBL_SHE63_PORT || '54663';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e',
  testMatch: ['two-futures-sprint.e2e.js', 'two-futures-compatibility.e2e.js', 'future-machine-share-reliability.e2e.js'],
  grep: /real paired runs:|guided controls,|forced unavailable WebGL|320px Canvas comparison|actual saved replay retains/,
  workers: 1,
  timeout: 150000,
  expect: { timeout: 30000 },
  outputDir: '../test-results/she63-matrix',
  reporter: [['list'], ['json', { outputFile: 'test-results/she63-matrix-results.json' }]],
  use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // Firefox/WebKit require their matching Playwright builds. WebKit is not Safari.
  projects: [
    { name: 'installed-chrome', use: { browserName: 'chromium', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-swiftshader'] } } },
    { name: 'playwright-firefox', use: { browserName: 'firefox' } },
    { name: 'playwright-webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'bun --no-env-file run server.js', cwd: process.cwd(), url: baseURL,
    reuseExistingServer: false, timeout: 60000,
    env: { PORT: port, HBL_WORLD_DB_PATH: join(store, 'world.sqlite'), HBL_CITY_DATA_DIR: join(store, 'city'), HBL_REALITY_SHARE_DB_PATH: join(store, 'shares.sqlite'), DECISION_STORE_DIR: join(store, 'decision') },
  },
});
