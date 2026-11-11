import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const port = process.env.HBL_RELEASE_BROWSER_PORT ?? '54407';
const baseURL = 'http://127.0.0.1:' + port;
export default defineConfig({
  testDir: './e2e',
  testMatch: ['release-journey.e2e.js', 'universe-shell.e2e.js',
    'living-city.e2e.js', 'bakery-mystery.e2e.js', 'discoveries-atlas.e2e.js'],
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL, launchOptions: { ...(executablePath && { executablePath }), args: ['--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'bun --no-env-file run server.js', cwd: process.cwd(), url: baseURL, reuseExistingServer: false,
    env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:' },
  },
});
