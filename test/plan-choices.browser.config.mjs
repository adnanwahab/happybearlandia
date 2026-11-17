import {defineConfig} from '@playwright/test';
const port=process.env.HBL_PLAN_TEST_PORT||'39889';
export default defineConfig({testDir:'./e2e',testMatch:'plan-choices.e2e.js',workers:1,timeout:120000,use:{baseURL:'http://127.0.0.1:'+port,browserName:'chromium',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}},webServer:{cwd:process.cwd(),command:'bun run server.js',env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'},url:'http://127.0.0.1:'+port+'/world',reuseExistingServer:false}});
