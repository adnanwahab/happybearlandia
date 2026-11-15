import {defineConfig} from '@playwright/test';
import startup from './startup-smoke.config.js';
export default defineConfig({...startup, testMatch:'world-peek.e2e.js', outputDir:'test-results/world-peek', reporter:'list'});
