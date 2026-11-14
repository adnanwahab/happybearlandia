import {defineConfig} from '@playwright/test';
import startup from './startup-smoke.config.js';
export default defineConfig({...startup, testMatch:'portal.e2e.js', outputDir:'test-results/portal', reporter:'list'});
