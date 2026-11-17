import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'magic-tour.e2e.js',workers:1,outputDir:'../test-results/magic-tour',use:{channel:'chrome',baseURL:'http://hbl.test',trace:'retain-on-failure'},reporter:[['list'],['json',{outputFile:'../test-results/she788-itinerary.json'}]]});
