import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'street-photographer.e2e.js',workers:1,outputDir:'/private/tmp/she712-browser',use:{baseURL:'https://hbl.test',browserName:'chromium',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{},trace:'retain-on-failure'}});
