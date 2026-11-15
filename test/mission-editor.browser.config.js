import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'mission-editor.e2e.js',outputDir:'/tmp/hbl-she570-browser'});
