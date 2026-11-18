import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'ghost-footsteps.e2e.js',workers:1,use:{browserName:'chromium'}});
