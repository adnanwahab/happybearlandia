import {createRequire} from 'node:module';
const {defineConfig}=createRequire((process.env.HBL_OUTCOME_APP_ROOT||process.cwd())+'/package.json')('@playwright/test');
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const store=mkdtempSync(join(tmpdir(),'outcome-delta-stores-'));
export default defineConfig({testDir:'./e2e',testMatch:'outcome-delta.e2e.js',workers:1,timeout:120000,expect:{timeout:30000},outputDir:'/tmp/outcome-delta-browser-evidence',use:{baseURL:'http://127.0.0.1:39917',browserName:'chromium',viewport:{width:1440,height:1000},reducedMotion:'reduce',screenshot:'only-on-failure'},webServer:{command:'bun --no-env-file run server.js',cwd:process.env.HBL_OUTCOME_APP_ROOT||process.cwd(),url:'http://127.0.0.1:39917/world/future-machine.html',reuseExistingServer:false,env:{PORT:'39917',HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'share.sqlite'),DECISION_STORE_DIR:join(store,'decision')}}});
