import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const port=process.env.HBL_RENDERER_TEST_PORT??'3198';
export default defineConfig({
 outputDir:join(tmpdir(),'happybearlandia-renderer-test-results'),
 testDir:'./e2e',testMatch:'style-bridge.e2e.js',timeout:120000,workers:1,
 use:{browserName:'chromium',hasTouch:true,baseURL:'http://127.0.0.1:'+port,trace:'retain-on-failure'},
 webServer:{cwd:process.cwd(),command:'bun run server.js',env:{PORT:port},url:'http://127.0.0.1:'+port+'/world?demo=1',reuseExistingServer:false},
});
