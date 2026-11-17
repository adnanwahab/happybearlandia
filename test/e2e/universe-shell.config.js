import { defineConfig } from '@playwright/test';
const port = process.env.HBL_UNIVERSE_TEST_PORT || '3197';
export default defineConfig({
  testDir: '.',testMatch:'universe-shell.e2e.js',workers:1,timeout:30000,
  use:{browserName:'chromium',baseURL:'http://127.0.0.1:'+port,trace:'retain-on-failure'},
  webServer:{cwd:process.cwd(),command:'bun run server.js',env:{PORT:port},url:'http://127.0.0.1:'+port+'/',reuseExistingServer:false},
});
