import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'city-circle.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:33773'},webServer:{cwd:new URL('..',import.meta.url).pathname,command:'PORT=33773 HBL_CITY_DATA_DIR=/tmp/hbl-she773-browser bun run server.js',url:'http://127.0.0.1:33773/world/city-lab.html',reuseExistingServer:false}});
