import {defineConfig} from '@playwright/test';
import hudConfig from './world-hud-local.config.js';
export default defineConfig({...hudConfig,testMatch:'hud-status-layout.e2e.js',outputDir:'../artifacts/she-789/status-layout'});
