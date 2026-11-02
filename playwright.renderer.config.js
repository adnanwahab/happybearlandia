import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
 outputDir:join(tmpdir(),'happybearlandia-renderer-test-results'),
 testDir:'./test/e2e',testMatch:'city-renderer.e2e.js',timeout:120000,workers:1,
 use:{browserName:'chromium',baseURL:'http://127.0.0.1:3198',trace:'retain-on-failure'},
 webServer:{command:'bun run server.js',env:{PORT:'3198'},url:'http://127.0.0.1:3198/world?demo=1',reuseExistingServer:false},
});
