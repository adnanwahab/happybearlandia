import { defineConfig } from '@playwright/test';
const port = process.env.HBL_GALLERY_TEST_PORT || '3399';
export default defineConfig({
  testDir: '.', testMatch: 'demo-gallery.e2e.js', workers: 1, timeout: 30000,
  outputDir: '/private/tmp/hbl-SHE-999-browser',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: {
    cwd: process.cwd(),
    command: `${process.env.HBL_BUN_EXECUTABLE || 'bun'} --no-env-file run server.js`,
    env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:', DECISION_STORE_DIR: '/private/tmp/hbl-SHE-999-decision', HBL_JOURNAL_ROOT: '/private/tmp/hbl-SHE-999-journals', HBL_DETECTIVE_ROOT: '/private/tmp/hbl-SHE-999-detective', NODE_ENV: 'test' },
    url: `http://127.0.0.1:${port}/demo-gallery`, reuseExistingServer: false,
  },
});
