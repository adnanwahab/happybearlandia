import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root=mkdtempSync(join(tmpdir(),'world-canvas-followup-'));
const port=process.env.HBL_WORLD_CANVAS_PORT||'39891';
export default defineConfig({testDir:'./e2e',testMatch:'world-canvas-followup.e2e.js',workers:1,timeout:90000,expect:{timeout:15000},outputDir:process.env.HBL_WORLD_CANVAS_ARTIFACTS||'/tmp/hbl-world-canvas-followup',use:{baseURL:`http://127.0.0.1:${port}`,screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}},webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:`http://127.0.0.1:${port}/world/`,reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DECISION_STORE_DIR:join(root,'decision')}}});
