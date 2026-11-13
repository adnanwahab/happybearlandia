import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'she-98-'));
const port=process.env.HBL_PLAYWRIGHT_PORT??'43891';
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./e2e',testMatch:'comparison-permalink.e2e.js',timeout:120000,workers:1,
  outputDir:join(root,'artifacts'),
  use:{baseURL,browserName:'chromium',trace:'retain-on-failure'},
  webServer:{command:'bun run server.js',cwd:new URL('..',import.meta.url).pathname,url:baseURL+'/world/future-machine.html',reuseExistingServer:false,
    env:{PORT:port,HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DECISION_STORE_DIR:join(root,'decision')}},
});
