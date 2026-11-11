import { defineConfig } from '@playwright/test';

const port = process.env.HBL_PLAYWRIGHT_PORT ?? '3100';
const partyPort = process.env.HBL_PLAYWRIGHT_PARTY_PORT ?? '3257';
const baseURL = 'http://127.0.0.1:' + port;
const partyURL = 'http://127.0.0.1:' + partyPort;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.e2e.js',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    browserName: 'chromium',
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      ...(executablePath && { executablePath }),
      args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: [
    {
      command: 'bun run server.js',
      env: { PORT: port },
      url: baseURL + '/game',
      reuseExistingServer: false,
    },
    {
      command: 'bun run test/e2e/act-normal-short-server.js',
      env: { PORT: partyPort },
      url: partyURL + '/world/party/act-normal',
      reuseExistingServer: false,
    },
  ],
});
