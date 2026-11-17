import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'building-perspective.e2e.js',workers:1,use:{channel:'chrome',hasTouch:true},outputDir:'../test-results/building-perspective'});
