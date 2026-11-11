import {createRequire} from 'node:module';
const {defineConfig}=createRequire((process.env.HBL_TEST_DEPENDENCY_ROOT||process.cwd())+'/package.json')('@playwright/test');
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const store=mkdtempSync(join(tmpdir(),'hbl-district-'));
export default defineConfig({testDir:'./e2e',testMatch:'district-comparison.e2e.js',workers:1,timeout:120000,expect:{timeout:30000},outputDir:'/tmp/hbl-district-browser',use:{baseURL:'http://127.0.0.1:39984',browserName:'chromium',viewport:{width:1440,height:1000},reducedMotion:'reduce',screenshot:'only-on-failure'},webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:'http://127.0.0.1:39984/world/future-machine.html',reuseExistingServer:false,env:{PORT:'39984',HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'share.sqlite'),DECISION_STORE_DIR:join(store,'decision')}}});
