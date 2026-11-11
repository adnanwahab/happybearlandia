import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const store=mkdtempSync(join(tmpdir(),'activity-first-run-'));
const port=process.env.HBL_ACTIVITY_FOLLOWUP_PORT||'41924';
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./e2e',testMatch:'activity-first-run-followup.e2e.js',workers:1,timeout:150000,expect:{timeout:30000},
 outputDir:process.env.HBL_ACTIVITY_FOLLOWUP_OUTPUT||join(process.cwd(),'test-results/activity-first-run-followup'),
 use:{baseURL,actionTimeout:20000,browserName:'chromium',viewport:{width:390,height:844},screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}},
 webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:baseURL+'/world/',reuseExistingServer:false,timeout:60000,env:{PORT:port,HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),DECISION_STORE_DIR:join(store,'decision')}},
});
