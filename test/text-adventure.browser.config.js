import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const data=mkdtempSync(join(tmpdir(),'hbl-text-')),port=process.env.HBL_PLAYWRIGHT_PORT||'39971';
export default defineConfig({testDir:'./e2e',testMatch:'text-adventure.e2e.js',workers:1,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${port}`,channel:'chrome',trace:'retain-on-failure'},
 outputDir:'../test-results/text-adventure',webServer:{cwd:process.cwd(),command:`${process.env.HBL_BUN_BIN||'bun'} --no-env-file server.js`,url:`http://127.0.0.1:${port}/world`,reuseExistingServer:false,
 env:{PORT:port,DEAR_CONGRESS_URL:'',HBL_WORLD_DB_PATH:join(data,'world.sqlite'),DECISION_STORE_DIR:join(data,'decision'),HBL_CITY_DATA_DIR:join(data,'city'),HBL_JOURNAL_ROOT:join(data,'journals')}}});
