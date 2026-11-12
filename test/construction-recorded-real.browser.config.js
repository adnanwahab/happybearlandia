// HBL_CONSTRUCTION_SOURCE_ROOT=/path/to/integrated/checkout bunx playwright test --config test/construction-recorded-real.browser.config.js
import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const source=process.env.HBL_CONSTRUCTION_SOURCE_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const store=mkdtempSync(join(tmpdir(),'construction-recorded-stores-'));
const port=process.env.HBL_CONSTRUCTION_PORT||'39972',baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./e2e',testMatch:'construction-recorded-real.e2e.js',workers:1,timeout:120000,expect:{timeout:30000},
 outputDir:process.env.HBL_CONSTRUCTION_ARTIFACT_DIR||join(tmpdir(),'hbl-construction-recorded'),
 metadata:{sourceRoot:source,stores:store},
 use:{baseURL,viewport:{width:1440,height:1000},browserName:'chromium',video:'retain-on-failure',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader',...(process.platform==='darwin'?['--use-angle=metal']:[])]}},
 webServer:{command:'bun --no-env-file run server.js',cwd:source,url:baseURL+'/world/future-machine.html',reuseExistingServer:false,timeout:60000,env:{PORT:port,HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),DECISION_STORE_DIR:join(store,'decision')}},
});
