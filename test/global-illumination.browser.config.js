import {defineConfig} from '@playwright/test';
const port=process.env.HBL_GI_PORT||'41960';
export default defineConfig({testDir:'./e2e',testMatch:'global-illumination.e2e.js',workers:1,timeout:120000,expect:{timeout:45000},outputDir:'/private/tmp/hbl-gi-browser-results',
use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-webgpu',...(process.platform==='darwin'?['--use-angle=metal']:['--enable-unsafe-swiftshader'])]}},
webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'}}});
