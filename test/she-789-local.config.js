import { defineConfig } from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const external=process.env.HBL_LAUNCH_TEST_URL;
const baseURL=external||'http://127.0.0.1:39973';
const store=mkdtempSync(join(tmpdir(),'hbl-launch-test-'));
export default defineConfig({
  testDir: './e2e',
  testMatch: ['she-789-integration.e2e.js','launch-shell.e2e.js','she-789-tiles.e2e.js','she-789-sound.e2e.js','session-logs.e2e.js','hud-status-layout.e2e.js'],
  workers: 1,
  timeout: 120000,
  expect: {timeout: 20000},
  outputDir: '../artifacts/she-789/integration',
  reporter: [['list']],
  use: {
    baseURL,
    viewport: {width:1440,height:900},
    trace: 'retain-on-failure',
    video: 'on',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),
      args: ['--enable-unsafe-webgpu','--enable-unsafe-swiftshader'],
    },
  },
  ...(!external&&{webServer:{
    cwd:resolve(__dirname,'..'),command:'bun --no-env-file server.js',url:baseURL+'/api/health',reuseExistingServer:false,
    env:{PORT:'39973',HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),HBL_JOURNAL_ROOT:join(store,'journals'),DECISION_STORE_DIR:join(store,'decision')},
  }}),
});
