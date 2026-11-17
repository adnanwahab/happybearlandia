import {defineConfig} from '@playwright/test';
const port=process.env.HBL_FLAGSHIP_PORT??'54419';
const baseURL='http://127.0.0.1:'+port;
export default defineConfig({
 testDir:'./e2e',
 testMatch:['approved-demo-responsive.e2e.js','flagship-history.e2e.js'],
 workers:1,timeout:120000,expect:{timeout:15000},
 use:{baseURL,trace:'retain-on-failure'},
 projects:['chromium','firefox','webkit'].map(browserName=>({
  name:browserName,use:{browserName,...(browserName==='chromium'?{launchOptions:{
   ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),
   args:['--enable-unsafe-swiftshader'],
  }}:{})},
 })),
 webServer:{command:(process.env.HBL_BUN_EXECUTABLE??'bun')+' --no-env-file run server.js',cwd:process.cwd(),url:baseURL,reuseExistingServer:false,
  env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'}},
});
