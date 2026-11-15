import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root=mkdtempSync(join(tmpdir(),'showcase-browser-')),port=process.env.HBL_SHOWCASE_PORT||'39985';
export default defineConfig({testDir:'./e2e',testMatch:'reality-showcase.e2e.js',workers:1,timeout:60000,use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',viewport:{width:1440,height:1000},reducedMotion:'reduce'},webServer:{cwd:process.cwd(),command:'bun --no-env-file server.js',url:`http://127.0.0.1:${port}/routes`,reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),HBL_JOURNAL_ROOT:join(root,'journals'),DECISION_STORE_DIR:join(root,'decision')}}});
