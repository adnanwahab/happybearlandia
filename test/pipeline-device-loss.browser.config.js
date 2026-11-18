import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(__dirname,'..');
const stores=mkdtempSync(join(tmpdir(),'pipeline-device-loss-stores-'));
const port=process.env.HBL_DEVICE_LOSS_PORT||'39974',baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./e2e',testMatch:'pipeline-device-loss.e2e.js',workers:1,timeout:120000,expect:{timeout:20000},
 metadata:{sourceRoot:root,stores},outputDir:process.env.HBL_DEVICE_LOSS_ARTIFACT_DIR||join(tmpdir(),'hbl-pipeline-device-loss'),
 use:{baseURL,viewport:{width:1440,height:1000},browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader',...(process.platform==='darwin'?['--use-angle=metal']:[])]}},
 webServer:{command:'bun --no-env-file run server.js',cwd:root,url:baseURL+'/world/future-machine.html',reuseExistingServer:false,timeout:60000,env:{PORT:port,HBL_WORLD_DB_PATH:join(stores,'world.sqlite'),HBL_CITY_DATA_DIR:join(stores,'city'),HBL_REALITY_SHARE_DB_PATH:join(stores,'shares.sqlite'),DECISION_STORE_DIR:join(stores,'decision')}},
});
