import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const store=mkdtempSync(join(tmpdir(),'hbl-vr-')),port=process.env.HBL_VR_PORT||'35781';
export default defineConfig({testDir:'./e2e',testMatch:'city-walk.e2e.js',workers:1,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${port}`,channel:'chrome',trace:'retain-on-failure'},outputDir:'../test-results/city-walk',
 webServer:process.env.HBL_VR_NO_SERVER==='1'?undefined:{cwd:process.cwd(),command:`${process.env.HBL_BUN_EXECUTABLE||'bun'} --no-env-file server.js`,url:`http://127.0.0.1:${port}/api/health`,reuseExistingServer:false,env:{PORT:port,DEAR_CONGRESS_URL:'',HBL_WORLD_DB_PATH:join(store,'world.sqlite'),DECISION_STORE_DIR:join(store,'decision'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_JOURNAL_ROOT:join(store,'journals')}}});
