import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'house-scrapbook.e2e.js',workers:1,use:{launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}}});
