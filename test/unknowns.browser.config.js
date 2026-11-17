import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'unknowns-map.e2e.js',workers:1,use:{headless:true},outputDir:'../artifacts/she-750'});
