import { defineConfig } from '@playwright/test';
const port = process.env.HBL_CUTAWAY_TEST_PORT || '35177';
export default defineConfig({
  testDir: './e2e', testMatch: 'storm-cutaway.e2e.js', workers: 1,
  timeout: 60000, expect: { timeout: 15000 },
  outputDir: '/private/tmp/she517-browser-results',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure',
    launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }), args: ['--enable-unsafe-swiftshader'] } },
  webServer: { command: 'bun --no-env-file run server.js', cwd: process.cwd(),
    env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:' }, url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
