import { defineConfig } from '@playwright/test';
import startup from '../startup-smoke.config.js';
export default defineConfig({
  ...startup,
  webServer: {...startup.webServer, command: `${process.env.HBL_BUN_EXECUTABLE || 'bun'} --no-env-file run server.js`},
  testDir: '.', testMatch: 'journey-stability.e2e.js', timeout: 240_000,
  outputDir: '../../test-results/journey-stability',
  reporter: 'list',
});
