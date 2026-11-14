import {defineConfig} from '@playwright/test';
import base from './e2e/universe-shell.config.js';
export default defineConfig({...base,testDir:'.',testMatch:'command-palette.e2e.js',outputDir:'test-results/command-palette',...(process.env.HBL_PALETTE_STATIC==='1'?{webServer:undefined}: {})});
