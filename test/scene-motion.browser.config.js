import {defineConfig} from '@playwright/test';
import base from './world-camera.browser.config.js';
export default defineConfig({...base,testMatch:'scene-motion.e2e.js',outputDir:'../test-results/scene-motion',webServer:{...base.webServer,command:`${process.env.HBL_BUN_EXECUTABLE||'bun'} --no-env-file server.js`}});
