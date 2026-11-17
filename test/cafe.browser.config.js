import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'./e2e', testMatch:'cafe-weekend.e2e.js', workers:1, use:{baseURL:'http://127.0.0.1:41783',browserName:'chromium'}, webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:'http://127.0.0.1:41783/world/business.html',env:{PORT:'41783'},reuseExistingServer:false} });
