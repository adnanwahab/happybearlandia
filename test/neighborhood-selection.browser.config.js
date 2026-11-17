import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const store=mkdtempSync(join(tmpdir(),'hbl-lasso-')),port=process.env.HBL_LASSO_PORT||'39447';
export default defineConfig({testDir:'./e2e',testMatch:'neighborhood-selection.e2e.js',workers:1,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${port}`,channel:'chromium',reducedMotion:'reduce',trace:'retain-on-failure'},
 outputDir:'../test-results/neighborhood-selection',webServer:{cwd:process.cwd(),command:'bun --no-env-file server.js',url:`http://127.0.0.1:${port}/api/health`,reuseExistingServer:false,
 env:{PORT:port,DEAR_CONGRESS_URL:'',HBL_WORLD_DB_PATH:join(store,'world.sqlite'),DECISION_STORE_DIR:join(store,'decision'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_JOURNAL_ROOT:join(store,'journals')}}});
