import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const store=mkdtempSync(join(tmpdir(),'hbl-camera-')),port='18472';
export default defineConfig({testDir:'./e2e',testMatch:'spatial-targets.e2e.js',workers:1,timeout:60000,
 use:{hasTouch:true,baseURL:`http://127.0.0.1:${port}`,channel:'chrome',launchOptions:{args:['--use-angle=metal']},trace:'retain-on-failure'},
 outputDir:'../test-results/spatial-targets',webServer:{cwd:process.cwd(),command:`${process.env.HBL_BUN_BIN||'bun'} --no-env-file server.js`,url:`http://127.0.0.1:${port}/api/health`,reuseExistingServer:false,
 env:{PORT:port,DEAR_CONGRESS_URL:'',HBL_WORLD_DB_PATH:join(store,'world.sqlite'),DECISION_STORE_DIR:join(store,'decision'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_JOURNAL_ROOT:join(store,'journals')}}});
