import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'third-place.e2e.js', workers: 1,
  use: { baseURL: 'http://127.0.0.1:54708', launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }) } },
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'bun --no-env-file run server.js', env: { PORT: '54708', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:54708', reuseExistingServer: false },
});
