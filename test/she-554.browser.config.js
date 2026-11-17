import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'house-guest-picker.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:31854',launchOptions:{args:['--no-sandbox']}},webServer:{command:'bun run server.js',cwd:process.cwd(),env:{PORT:'31854'},url:'http://127.0.0.1:31854/game',reuseExistingServer:false}});
