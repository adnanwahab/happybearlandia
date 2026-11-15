import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'hbl-wander-')),port=process.env.HBL_WANDER_PORT||'39975';
export default defineConfig({testDir:'./e2e',testMatch:'wander.e2e.js',workers:1,timeout:90000,expect:{timeout:20000},outputDir:'../test-results/wander',use:{baseURL:`http://127.0.0.1:${port}`,launchOptions:{args:['--enable-unsafe-swiftshader']},trace:'retain-on-failure'},webServer:{cwd:process.cwd(),command:'bun --no-env-file server.js',url:`http://127.0.0.1:${port}/api/health`,reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),DECISION_STORE_DIR:join(root,'decision'),HBL_JOURNAL_ROOT:join(root,'journals'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DEAR_CONGRESS_URL:''}}});
