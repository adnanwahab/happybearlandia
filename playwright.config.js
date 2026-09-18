import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.e2e.js',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun run server.js',
    env: { PORT: '3100' },
    url: 'http://127.0.0.1:3100/game',
    reuseExistingServer: false,
  },
});
