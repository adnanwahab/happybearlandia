import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'district-title.component.e2e.js',workers:1,use:{channel:'chrome'},outputDir:'../test-results/district-title'});
