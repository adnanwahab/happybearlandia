import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'comfort.e2e.js',outputDir:'test-results/comfort',webServer:{...base.webServer,command:`${process.env.HBL_BUN_EXECUTABLE||'bun'} --no-env-file run server.js`}});
