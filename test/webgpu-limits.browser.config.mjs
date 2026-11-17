import { defineConfig } from '@playwright/test';

const port = process.env.HBL_GPU_TEST_PORT || '54468';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e',
  testMatch: 'sculpt-a-storm.e2e.js',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }),
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'bun --no-env-file run server.js',
    cwd: process.cwd(),
    env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:' },
    url: baseURL,
    reuseExistingServer: false,
  },
});
