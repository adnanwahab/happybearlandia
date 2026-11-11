import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=mkdtempSync(join(tmpdir(),'future-machine-browser-'));
const baseURL='http://127.0.0.1:39884';
export default defineConfig({
 outputDir:process.env.HBL_FM_ARTIFACT_DIR||join(process.cwd(),'test-results/future-machine'),
 testDir:'./e2e',testMatch:'future-machine.e2e.js',workers:1,timeout:120000,expect:{timeout:30000},
 use:{baseURL,browserName:'chromium',viewport:{width:1440,height:1000},video:process.env.HBL_RECORD_DEMO?'on':'retain-on-failure',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}},
 webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:baseURL+'/world/future-machine.html',reuseExistingServer:false,env:{PORT:'39884',HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DECISION_STORE_DIR:join(root,'decision')}},
});
