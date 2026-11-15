import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
export default defineConfig({...canonical,testMatch:'future-machine-clip.e2e.js'});
