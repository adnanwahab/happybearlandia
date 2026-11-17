import {defineConfig} from '@playwright/test';
// Source transport isolates navigation from GPU/provider/model startup. No API mocks.
export default defineConfig({testDir:'./e2e',testMatch:'world-continuity.e2e.js',workers:1,timeout:20000,reporter:'list',use:{baseURL:'http://127.0.0.1:39961',browserName:'chromium',hasTouch:true,reducedMotion:'reduce'},outputDir:'test-results/world-continuity'});
