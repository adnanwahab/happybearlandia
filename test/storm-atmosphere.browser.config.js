import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'storm-atmosphere.e2e.js', workers: 1,
  timeout: 60000, outputDir: '/private/tmp/she512-browser',
  use: { baseURL: 'http://127.0.0.1:3198', browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--enable-unsafe-swiftshader'] } },
  webServer: { cwd: process.cwd(), command: 'bun --no-env-file run server.js',
    env: { PORT: '3198', HBL_WORLD_DB_PATH: ':memory:' },
    url: 'http://127.0.0.1:3198', reuseExistingServer: false },
});
