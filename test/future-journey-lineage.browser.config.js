import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const port = process.env.HBL_RELEASE_BROWSER_PORT ?? '54482';
const baseURL = 'http://127.0.0.1:' + port;
export default defineConfig({
  testDir: './e2e',
  testMatch: ['future-journey-lineage.e2e.js'],
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL, hasTouch: true, trace: 'retain-on-failure', launchOptions: {
    ...(executablePath && { executablePath }),
    args: [...(executablePath ? [] : ['--use-gl=angle', '--use-angle=swiftshader']), '--enable-unsafe-swiftshader'],
  } },
  webServer: {
    command: 'bun --no-env-file run server.js', cwd: process.cwd(), url: baseURL, reuseExistingServer: false,
    env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:' },
  },
});
