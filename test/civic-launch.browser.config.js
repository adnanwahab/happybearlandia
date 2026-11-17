import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:['civic-launch.e2e.js','law-behavior-playback.e2e.js','world-cycle-lifecycle.e2e.js'],workers:1,timeout:90000,
 use:{baseURL:process.env.HBL_LAUNCH_URL||'http://127.0.0.1:4498',browserName:'chromium',channel:'chrome',trace:'retain-on-failure',launchOptions:{args:['--use-angle=metal']}},
 outputDir:'../test-results/civic-launch'});
