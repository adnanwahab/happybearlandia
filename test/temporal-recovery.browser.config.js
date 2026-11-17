import {defineConfig} from '@playwright/test';
import {resolve,join} from 'node:path';

const value=process.env.HBL_TEMPORAL_VERIFY_URL;
let url;
try{url=new URL(value);}catch{throw Error('Run bun --no-env-file scripts/verify-temporal-recovery.mjs to start an isolated temporal verification server.');}
if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port)throw Error('Temporal verification requires its owned HTTP loopback server URL.');
const artifacts=resolve(process.env.HBL_TEMPORAL_ARTIFACT_DIR||'test-results/temporal-recovery');
export default defineConfig({
 testDir:'./e2e',testMatch:['temporal-recovery.e2e.js','temporal-recovery-integration.e2e.js'],
 workers:1,timeout:120000,expect:{timeout:15000},outputDir:join(artifacts,'results'),
 reporter:[['list'],['json',{outputFile:join(artifacts,'results.json')}]],
 use:{baseURL:url.origin,trace:'retain-on-failure',launchOptions:{
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),
  args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader'],
 }},
});
