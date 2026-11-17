import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'city-tour.component.e2e.js',workers:1,use:{channel:'chrome'},outputDir:'../test-results/city-tour'});
