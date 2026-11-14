import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'house-action-feedback-isolated.e2e.js',workers:1,use:{browserName:'chromium',reducedMotion:'reduce'}});
