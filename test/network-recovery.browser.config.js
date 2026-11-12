import {defineConfig} from '@playwright/test';
const port=process.env.HBL_RECOVERY_BROWSER_PORT??'39876';
export default defineConfig({testDir:'./e2e',testMatch:'network-recovery.e2e.js',workers:1,
 use:{baseURL:`http://127.0.0.1:${port}`,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},
 webServer:{cwd:process.cwd(),command:'bun --no-env-file run server.js',url:`http://127.0.0.1:${port}`,env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'},reuseExistingServer:false}});
