import {defineConfig} from '@playwright/test';
import base from './e2e/universe-shell.config.js';
export default defineConfig({...base,testDir:'.',testMatch:'preview-swipe.e2e.js',outputDir:'test-results/preview-swipe'});
