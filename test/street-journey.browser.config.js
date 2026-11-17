import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'street-journey.component.e2e.js',workers:1,use:{channel:'chrome'},outputDir:'../test-results/street-journey'});
