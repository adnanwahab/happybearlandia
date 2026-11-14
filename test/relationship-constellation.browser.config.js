import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'relationship-constellation.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:39947'},webServer:{command:'python3 -m http.server 39947 --bind 127.0.0.1',url:'http://127.0.0.1:39947',reuseExistingServer:false}});
