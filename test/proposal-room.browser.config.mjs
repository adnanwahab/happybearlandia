import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const baseURL = 'http://127.0.0.1:54565';
export default defineConfig({
  testDir: './e2e', testMatch: ['proposal-room.e2e.js'],
  workers: 1, timeout: 60000, expect: { timeout: 15000 },
  outputDir: '../test-results/proposal-room',
  use: { browserName: 'chromium', baseURL, hasTouch: true, trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'bun --no-env-file run server.js',
    env: { PORT: '54565', HBL_WORLD_DB_PATH: ':memory:' }, url: baseURL, reuseExistingServer: false,
  },
});
