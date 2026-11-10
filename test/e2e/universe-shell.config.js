import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',testMatch:'universe-shell.e2e.js',workers:1,timeout:30000,
  use:{browserName:'chromium',baseURL:'http://127.0.0.1:3197',trace:'retain-on-failure'},
  webServer:{cwd:process.cwd(),command:'bun run server.js',env:{PORT:'3197'},url:'http://127.0.0.1:3197/',reuseExistingServer:false},
});
