import {defineConfig} from '@playwright/test';
const port=process.env.HBL_PLAYWRIGHT_PORT||'39961';
export default defineConfig({testDir:'./e2e',testMatch:'population-trips.e2e.js',workers:1,timeout:60000,use:{browserName:'chromium',baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',launchOptions:{args:['--enable-unsafe-webgpu']}},webServer:{command:'bun run server.js',cwd:process.cwd(),env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'},url:`http://127.0.0.1:${port}/world`,reuseExistingServer:false}});
