import {defineConfig} from '@playwright/test';
import startup from './startup-smoke.config.js';
export default defineConfig({...startup, testMatch:'navigation-accessibility.e2e.js', use:{...startup.use,hasTouch:true},outputDir:'test-results/navigation-accessibility',reporter:'list',webServer:process.env.HBL_NAV_STATIC === '1' ? undefined : {...startup.webServer,command:`${process.env.HBL_BUN_BIN || 'bun'} --no-env-file run server.js`}});
