import {defineConfig} from '@playwright/test';
// Route-fulfilled module fixture; usable without starting application services.
export default defineConfig({testDir:'./e2e',testMatch:'pantry-evening.e2e.js',workers:1,use:{browserName:'chromium'}});
