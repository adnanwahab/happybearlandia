import {defineConfig} from '@playwright/test';
import canonical from './future-machine-race.browser.config.js';
export default defineConfig({...canonical,testMatch:'future-machine-first-separation.e2e.js'});
