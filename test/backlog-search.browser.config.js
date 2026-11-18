import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const sourceRoot = resolve(process.env.HBL_SEARCH_SOURCE_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const port = process.env.HBL_SEARCH_PORT || '54582';
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error('Invalid HBL_SEARCH_PORT');
// Unique private stores on every invocation; no original checkout data is used.
const stores = mkdtempSync(join(tmpdir(), 'hbl-search-browser-'));
export default defineConfig({
  testDir: '.', testMatch: 'backlog-search.browser.e2e.js', workers: 1,
  timeout: 60000, expect: { timeout: 7000 },
  outputDir: process.env.HBL_SEARCH_ARTIFACTS || join(stores, 'artifacts'),
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }), args: ['--enable-unsafe-swiftshader'] } },
  webServer: { cwd: sourceRoot, command: 'bun --no-env-file run server.js', reuseExistingServer: false,
    url: `http://127.0.0.1:${port}/world/decision.html`,
    env: { PORT: port, DECISION_STORE_DIR: join(stores, 'decision'), HBL_WORLD_DB_PATH: join(stores, 'world.sqlite'), HBL_REALITY_SHARE_DB_PATH: join(stores, 'shares.sqlite') } },
});
