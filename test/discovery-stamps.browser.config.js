import {defineConfig} from '@playwright/test';
const port = process.env.HBL_STAMPS_PORT || '31974';
export default defineConfig({testDir:'./e2e',testMatch:'discovery-stamps.e2e.js',workers:1,
 use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium'},
 webServer:{command:'bun run server.js',cwd:process.cwd(),env:{PORT:port},url:`http://127.0.0.1:${port}/routes`,reuseExistingServer:false},
});
