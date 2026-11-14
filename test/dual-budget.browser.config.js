import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'dual-budget.e2e.js',timeout:180000,outputDir:'/private/tmp/she165-browser',use:{...base.use,video:'on'}});
