import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'street-steps.component.e2e.js',workers:1,use:{channel:'chrome',viewport:{width:390,height:844},hasTouch:true},outputDir:'../test-results/street-steps'});
