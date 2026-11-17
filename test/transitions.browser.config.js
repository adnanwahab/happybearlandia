import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'transitions.e2e.js',outputDir:'test-results/transitions',webServer:{...base.webServer,command:`${process.env.HBL_BUN_EXECUTABLE||'bun'} --no-env-file run server.js`}});
