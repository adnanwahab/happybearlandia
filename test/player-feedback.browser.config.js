import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'hbl-reactions-'));
const port = process.env.HBL_PLAYWRIGHT_PORT || '3586';
export default defineConfig({
  testDir: './e2e', testMatch: 'player-feedback.e2e.js', workers: 1, timeout: 60000,
  outputDir: '../test-results/player-feedback',
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'chromium', trace: 'retain-on-failure' },
  webServer: { cwd: process.cwd(), command: `${process.env.HBL_BUN_EXECUTABLE || 'bun'} --no-env-file server.js`, url: `http://127.0.0.1:${port}/api/health`, reuseExistingServer: false,
    env: { PORT: port, DEAR_CONGRESS_URL: '', HBL_WORLD_DB_PATH: join(directory, 'world.sqlite'),
      DECISION_STORE_DIR: join(directory, 'decision'), HBL_CITY_DATA_DIR: join(directory, 'city'), HBL_JOURNAL_ROOT: join(directory, 'journals') } },
});
