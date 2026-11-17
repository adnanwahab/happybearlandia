import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'future-machine-challenges.e2e.js',outputDir:'/tmp/hbl-she118-browser'});
