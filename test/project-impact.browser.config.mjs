import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: './e2e', testMatch: 'project-impact.e2e.js', workers: 1,
  use: { hasTouch: true, baseURL: 'http://127.0.0.1:54571', launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }) } },
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: `${process.env.HBL_BUN_BIN || 'bun'} --no-env-file run server.js`, env: { PORT: '54571', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:54571', reuseExistingServer: false },
});
