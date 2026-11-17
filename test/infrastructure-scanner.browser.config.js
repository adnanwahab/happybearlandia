import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'infrastructure-scanner.component.e2e.js',workers:1,use:{channel:'chrome'},outputDir:'../test-results/infrastructure-scanner'});
