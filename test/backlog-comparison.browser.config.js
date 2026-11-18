import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
const store = mkdtempSync(join(tmpdir(), 'hbl-comparison-stores-'));
const port = process.env.HBL_COMPARISON_PORT || '39983';
export default defineConfig({
  testDir: '.', testMatch: 'backlog-comparison.browser.e2e.js', workers: 1, timeout: 180000,
  outputDir: process.env.HBL_COMPARISON_ARTIFACTS || '/tmp/hbl-backlog-comparison-proof',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure', launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
  } },
  webServer: { command: 'bun --no-env-file run server.js', cwd: process.env.HBL_COMPARISON_SOURCE_ROOT || new URL('..', import.meta.url).pathname,
    env: { PORT: port, HBL_WORLD_DB_PATH: join(store, 'world.sqlite'), HBL_CITY_DATA_DIR: join(store, 'city'), HBL_REALITY_SHARE_DB_PATH: join(store, 'shares.sqlite'), HBL_JOURNAL_ROOT: join(store, 'journals'), DECISION_STORE_DIR: process.env.HBL_COMPARISON_STORE || `/tmp/hbl-comparison-store-${port}` },
    url: `http://127.0.0.1:${port}/world/decision.html`, reuseExistingServer: false },
});
