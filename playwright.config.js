import { defineConfig } from '@playwright/test';

import {createBrowserEnvironment} from './test/support/browser-environment.js';
const app=createBrowserEnvironment({name:'playwright'});
const party=createBrowserEnvironment({name:'playwright-party',portEnv:'HBL_PLAYWRIGHT_PARTY_PORT'});
const baseURL=app.baseURL,partyURL=party.baseURL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './test/e2e',
  globalSetup:'./test/support/browser-global-setup.js',
  metadata: {partyURL,browserEnvironments:[app.descriptor,party.descriptor]},
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
      command: 'bun --no-env-file run server.js',
      env: app.serverEnv,
      url: baseURL + '/game',
      reuseExistingServer: false,
    },
    {
      command: 'bun --no-env-file run test/e2e/act-normal-short-server.js',
      env: party.serverEnv,
      url: partyURL + '/world/party/act-normal',
      reuseExistingServer: false,
    },
  ],
});
