import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'boundary-preview.e2e.js', workers: 1,
  use: { baseURL: 'http://127.0.0.1:15478', launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }) } },
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: `${process.env.BUN_EXECUTABLE || 'bun'} --no-env-file run server.js`, env: { PORT: '15478', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:15478', reuseExistingServer: false },
});
