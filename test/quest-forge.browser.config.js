import { defineConfig } from '@playwright/test';
import base from './future-machine.browser.config.js';
export default defineConfig({ ...base, testMatch: 'quest-forge.e2e.js', outputDir: '/tmp/hbl-she720-browser' });
