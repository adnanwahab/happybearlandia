import {defineConfig} from '@playwright/test';
import {createBrowserEnvironment} from './support/browser-environment.js';
const {baseURL,serverEnv,descriptor}=createBrowserEnvironment({name:'first-run'});
export default defineConfig({
 globalSetup:'./support/browser-global-setup.js',metadata:{browserEnvironments:[descriptor]},
  testDir:'./e2e',testMatch:'world-first-run.e2e.js',
  use:{browserName:'chromium',baseURL,trace:'retain-on-failure',launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']}},
  workers:1,timeout:30000,
  webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),env:serverEnv,url:baseURL+'/world',reuseExistingServer:false},
});
