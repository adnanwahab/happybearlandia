import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

import {createBrowserEnvironment} from './support/browser-environment.js';
const {baseURL,serverEnv,descriptor}=createBrowserEnvironment({name:'startup-smoke',portEnv:'HBL_STARTUP_SMOKE_PORT'});

export default defineConfig({
 globalSetup:'./support/browser-global-setup.js',metadata:{browserEnvironments:[descriptor]},
  testDir: './e2e',
  testMatch: 'startup-smoke.e2e.js',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  outputDir: join(process.cwd(), 'test-results/startup-smoke'),
  reporter: [['list'], ['json', { outputFile: join(process.cwd(), 'test-results/startup-smoke-results.json') }]],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'bun --no-env-file run server.js',
    cwd: process.cwd(),
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: serverEnv,
  },
});
