import {defineConfig} from '@playwright/test';
const port=process.env.HBL_PLAYWRIGHT_PORT||'39889';
const baseURL='http://127.0.0.1:'+port;
export default defineConfig({
  testDir:'./e2e',testMatch:'world-first-run.e2e.js',
  use:{browserName:'chromium',baseURL,trace:'retain-on-failure'},
  workers:1,timeout:30000,
  webServer:{command:'bun run server.js',cwd:process.cwd(),env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'},url:baseURL+'/world',reuseExistingServer:false},
});
