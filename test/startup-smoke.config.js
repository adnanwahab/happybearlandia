import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const store = mkdtempSync(join(tmpdir(), 'hbl-startup-smoke-'));
const port = process.env.HBL_STARTUP_SMOKE_PORT || '39961';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'startup-smoke.e2e.js',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  outputDir: join(process.cwd(), 'test-results/startup-smoke'),
  reporter: [['list'], ['json', { outputFile: join(process.cwd(), 'test-results/startup-smoke-results.json') }]],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'bun --no-env-file run server.js',
    cwd: process.cwd(),
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: port,
      HBL_WORLD_DB_PATH: join(store, 'world.sqlite'),
      HBL_CITY_DATA_DIR: join(store, 'city'),
      HBL_REALITY_SHARE_DB_PATH: join(store, 'shares.sqlite'),
      HBL_JOURNAL_ROOT: join(store, 'journals'),
      DECISION_STORE_DIR: join(store, 'decision'),
    },
  },
});
