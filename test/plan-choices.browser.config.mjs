import {defineConfig} from '@playwright/test';
import {createBrowserEnvironment} from './support/browser-environment.js';
const {baseURL,serverEnv,descriptor}=createBrowserEnvironment({name:'plan-choices',portEnv:'HBL_PLAN_TEST_PORT'});
export default defineConfig({
 globalSetup:'./support/browser-global-setup.js',metadata:{browserEnvironments:[descriptor]},testDir:'./e2e',testMatch:'plan-choices.e2e.js',workers:1,timeout:120000,use:{baseURL,browserName:'chromium',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}},webServer:{cwd:process.cwd(),command:'bun --no-env-file run server.js',env:serverEnv,url:baseURL+'/world',reuseExistingServer:false}});
