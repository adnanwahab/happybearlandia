import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'contextual-hints.e2e.js',workers:1,use:{browserName:'chromium',launchOptions:process.env.HBL_HINT_BROWSER ? {executablePath:process.env.HBL_HINT_BROWSER} : {},baseURL:'http://hbl.test',trace:'retain-on-failure'}});
