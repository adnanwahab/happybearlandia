import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const store=mkdtempSync(join(tmpdir(),'two-futures-sprint-'));
const port=process.env.HBL_TWO_FUTURES_PORT||'39931';
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./e2e',testMatch:['two-futures-sprint.e2e.js','two-futures-compatibility.e2e.js'],workers:1,timeout:150000,expect:{timeout:30000},
 outputDir:process.env.HBL_TWO_FUTURES_ARTIFACT_DIR||join(process.cwd(),'test-results/two-futures-sprint'),
 use:{baseURL,actionTimeout:15000,browserName:'chromium',viewport:{width:1440,height:1000},video:{mode:process.env.HBL_RECORD_DEMO?'on':'retain-on-failure',size:{width:1440,height:1000}},screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader',...(process.env.HBL_NATIVE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[]),...(process.env.HBL_BACKEND_ANGLE?['--use-angle='+process.env.HBL_BACKEND_ANGLE]:[])]}},
 webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:baseURL+'/world/future-machine.html',reuseExistingServer:false,timeout:60000,env:{PORT:port,HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),DECISION_STORE_DIR:join(store,'decision')}},
});
