import {defineConfig} from '@playwright/test';
const port=process.env.HBL_PICK_PORT||'39945';
export default defineConfig({testDir:'./e2e',testMatch:'magnetic-picking.e2e.js',workers:1,timeout:90000,use:{hasTouch:true,baseURL:'http://127.0.0.1:'+port,launchOptions:{args:['--enable-unsafe-swiftshader']}},webServer:{cwd:process.cwd(),command:'bun run server.js',env:{PORT:port},url:'http://127.0.0.1:'+port+'/world',reuseExistingServer:false}});
