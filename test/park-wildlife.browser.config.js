import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'park-wildlife.e2e.js',webServer:{...base.webServer,command:`${process.env.HBL_BUN_EXECUTABLE || 'bun'} --no-env-file run server.js`}});
