import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',testMatch:'world-first-run.e2e.js',
  use:{browserName:'chromium',baseURL:'http://127.0.0.1:39889',trace:'retain-on-failure'},
  workers:1,timeout:30000,
  webServer:{command:'bun run server.js',cwd:process.cwd(),env:{PORT:'39889',HBL_WORLD_DB_PATH:':memory:'},url:'http://127.0.0.1:39889/world',reuseExistingServer:false},
});
