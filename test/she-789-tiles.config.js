import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:['she-789-tiles.e2e.js','she-789-sound.e2e.js'],timeout:90000,workers:1,expect:{timeout:20000},outputDir:'../artifacts/she-789/tiles',use:{baseURL:process.env.HBL_LAUNCH_TEST_URL||'http://127.0.0.1:62691',launchOptions:{args:['--enable-unsafe-swiftshader']}}});
