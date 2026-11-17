import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'heartbeat.e2e.js',workers:1,use:{headless:true,viewport:{width:390,height:844}},timeout:30000});
