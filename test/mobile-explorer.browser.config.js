import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'mobile-explorer.e2e.js',workers:1,use:{channel:'chrome',hasTouch:true,isMobile:true},outputDir:'../test-results/mobile-explorer',reporter:[['list'],['json',{outputFile:'../test-results/mobile-explorer-receipt.json'}]]});
