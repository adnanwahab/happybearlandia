import {defineConfig} from '@playwright/test';
import launchConfig from './launch-shell-local.config.js';
export default defineConfig({
 ...launchConfig,
 testMatch:'world-hud.e2e.js',
 timeout:180000,
 outputDir:'../artifacts/she-789/hud',
 use:{...launchConfig.use,baseURL:process.env.HBL_LAUNCH_TEST_URL||'http://127.0.0.1:39972'},
});
