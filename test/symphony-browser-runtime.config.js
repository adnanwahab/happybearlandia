import {defineConfig} from '@playwright/test';
import {createBrowserEnvironment} from './support/browser-environment.js';
const environment=createBrowserEnvironment({name:'symphony-browser-runtime'});
export default defineConfig({testDir:'./e2e',testMatch:'symphony-browser-runtime.e2e.js',
 timeout:60000,expect:{timeout:15000},workers:1,retries:0,
 use:{baseURL:environment.baseURL},
 globalSetup:'./support/browser-global-setup.js',metadata:{browserEnvironments:[environment.descriptor]},
 webServer:{command:'bun --no-env-file server.js',url:environment.baseURL+'/api/health',
 env:environment.serverEnv,reuseExistingServer:false,timeout:60000}});
