import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'city-tournament.e2e.js',outputDir:'/tmp/SHE-775-browser'});
