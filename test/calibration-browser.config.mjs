import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'reality-calibration-lab.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:43981'},webServer:{command:'bun run server.js',cwd:new URL('..',import.meta.url).pathname,env:{PORT:'43981'},url:'http://127.0.0.1:43981/world/calibration/',reuseExistingServer:false}});
