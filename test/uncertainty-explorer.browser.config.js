import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'uncertainty-explorer.e2e.js',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:41888',browserName:'chromium'},webServer:{command:'bun run server.js',cwd: process.cwd(),env:{PORT:'41888'},url:'http://127.0.0.1:41888/world/experiment-lab.html',reuseExistingServer:false}});
