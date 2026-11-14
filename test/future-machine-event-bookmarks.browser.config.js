import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
export default defineConfig({...canonical,testMatch:'future-machine-event-bookmarks.e2e.js',use:{...canonical.use,hasTouch:true}});
