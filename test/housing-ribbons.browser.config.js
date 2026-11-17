import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'housing-ribbons.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:54987',headless:true},webServer:{command:'python3 -m http.server 54987 --bind 127.0.0.1',url:'http://127.0.0.1:54987',reuseExistingServer:false}});
