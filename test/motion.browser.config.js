import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({...base,testMatch:'motion.e2e.js',outputDir:'test-results/motion'});
