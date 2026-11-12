import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'experiment-registry.e2e.js', timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:39877', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: { command: 'bun --no-env-file run server.js', cwd: process.cwd(),
    env: { PORT: '39877', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:39877/world/experiment-lab.html' },
});
