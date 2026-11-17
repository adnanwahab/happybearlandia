import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
import {createBrowserEnvironment} from './support/browser-environment.js';
const {baseURL,serverEnv,descriptor}=createBrowserEnvironment({name:'future-machine',portEnv:'HBL_FM_PORT'});
export default defineConfig({
 globalSetup:'./support/browser-global-setup.js',metadata:{browserEnvironments:[descriptor]},
 outputDir:process.env.HBL_FM_ARTIFACT_DIR||join(process.cwd(),'test-results/future-machine'),
 testDir:'./e2e',testMatch:'future-machine.e2e.js',workers:1,timeout:120000,expect:{timeout:30000},
 use:{baseURL,browserName:'chromium',viewport:{width:1440,height:1000},video:process.env.HBL_RECORD_DEMO?'on':'retain-on-failure',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}},
 webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:baseURL+'/world/future-machine.html',reuseExistingServer:false,env:serverEnv},
});
