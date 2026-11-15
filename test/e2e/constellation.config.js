import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'constellation.e2e.js',workers:1,use:{baseURL:'http://hbl.test',browserName:'chromium',launchOptions:process.env.HBL_BROWSER?{executablePath:process.env.HBL_BROWSER}:{}}});
