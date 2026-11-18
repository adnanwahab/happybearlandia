import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const appRoot=resolve(process.env.HBL_TRANSITIONS_APP_ROOT||process.cwd());
const {defineConfig}=createRequire(join(process.env.HBL_TRANSITIONS_TOOLS_ROOT||appRoot,'package.json'))('@playwright/test');
const store=mkdtempSync(join(tmpdir(),'hbl-transitions-'));
const port=process.env.HBL_TRANSITIONS_PORT||'39927';
export default defineConfig({testDir:'.',testMatch:process.env.HBL_TRANSITIONS_PRODUCTION_ONLY==='1'?'backlog-transitions-production.browser.js':'backlog-transitions.browser.js',workers:1,timeout:120000,expect:{timeout:30000},outputDir:process.env.HBL_TRANSITIONS_OUTPUT||'/tmp/hbl-backlog-transitions-browser',use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']}},webServer:{command:'bun --no-env-file run server.js',cwd:appRoot,url:`http://127.0.0.1:${port}/world/decision.html`,reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'share.sqlite'),HBL_JOURNAL_ROOT:join(store,'journals'),DECISION_STORE_DIR:join(store,'decision')}}});
