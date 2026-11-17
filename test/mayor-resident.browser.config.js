import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'mayor-resident.e2e.js',outputDir:'/tmp/hbl-she771-browser'});
