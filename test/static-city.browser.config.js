import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'static-city.e2e.js',workers:1,timeout:60000,expect:{timeout:30000},outputDir:'../artifacts/she-789/static-city',use:{browserName:'webkit',baseURL:process.env.HBL_LAUNCH_TEST_URL||'http://127.0.0.1:39972',screenshot:'only-on-failure',trace:'retain-on-failure'}});
