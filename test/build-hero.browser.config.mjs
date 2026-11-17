import {defineConfig} from '@playwright/test';
const port=process.env.HBL_PLAYWRIGHT_PORT||'3194';
export default defineConfig({testDir:'./e2e',testMatch:'build-hero.e2e.js',workers:1,timeout:90000,expect:{timeout:20000},use:{baseURL:`http://127.0.0.1:${port}`,launchOptions:{args:['--enable-unsafe-swiftshader']}},webServer:{cwd:new URL('..',import.meta.url).pathname,command:`${process.env.HBL_BUN_EXECUTABLE||'bun'} run server.js`,env:{PORT:port},url:`http://127.0.0.1:${port}/game`,reuseExistingServer:false}});
