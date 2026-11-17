import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'evidence-hunt.e2e.js',workers:1,
  use:{baseURL:'https://hunt.test',channel:'chrome'},
  outputDir:'../test-results/evidence-hunt-component'});
