import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const port=process.env.HBL_RENDERER_TEST_PORT??'3198';
export default defineConfig({
 outputDir:join(tmpdir(),'happybearlandia-renderer-test-results'),
 testDir:'./test/e2e',testMatch:'city-renderer.e2e.js',timeout:120000,workers:1,
 use:{browserName:'chromium',baseURL:'http://127.0.0.1:'+port,trace:'retain-on-failure'},
 webServer:{command:'bun run server.js',env:{PORT:port},url:'http://127.0.0.1:'+port+'/world?demo=1',reuseExistingServer:false},
});
