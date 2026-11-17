import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'hbl-recipes-'));
export default defineConfig({
  testDir:'./test/e2e', testMatch:'future-machine-recipes.e2e.js',
  outputDir:join(root,'results'), timeout:120000, workers:1,
  use:{browserName:'chromium',baseURL:'http://127.0.0.1:41949',trace:'retain-on-failure'},
  webServer:{command:'bun run server.js',env:{PORT:'41949',HBL_CITY_DATA_DIR:join(root,'city')},url:'http://127.0.0.1:41949/world/future-machine.html',reuseExistingServer:false},
});
