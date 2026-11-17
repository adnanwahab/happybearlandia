import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'crisis-drill.e2e.js',outputDir:'/tmp/hbl-she718-browser',webServer:{...base.webServer,command:process.env.HBL_BUN_PATH?`"${process.env.HBL_BUN_PATH}" --no-env-file run server.js`:base.webServer.command}});
