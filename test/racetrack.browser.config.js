import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'racetrack.e2e.js',workers:1,timeout:30000,
 use:{baseURL:'http://localhost:39886',browserName:'chromium',screenshot:'only-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}}});
