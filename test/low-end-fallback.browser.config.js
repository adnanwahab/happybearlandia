import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const stores=mkdtempSync(join(tmpdir(),'hbl-low-end-'));
const port=process.env.HBL_LOW_END_PORT||'39978';
export default defineConfig({
 testDir:'./e2e',testMatch:'low-end-fallback.e2e.js',workers:1,timeout:120000,
 outputDir:process.env.HBL_LOW_END_ARTIFACT_DIR||'/tmp/hbl-low-end-fallback',
 use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',trace:'retain-on-failure',launchOptions:{args:['--disable-gpu'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}},
 webServer:{cwd:process.cwd(),command:'bun --no-env-file run server.js',url:`http://127.0.0.1:${port}/world/future-machine.html`,reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:join(stores,'world.sqlite'),HBL_CITY_DATA_DIR:join(stores,'city'),HBL_REALITY_SHARE_DB_PATH:join(stores,'shares.sqlite'),DECISION_STORE_DIR:join(stores,'decision')}},
});
