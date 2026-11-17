import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
const port = process.env.HBL_DIFFUSION_TEST_PORT || '55175';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e', testMatch: 'diffusion-tag.e2e.js', workers: 1,
  use: { baseURL, browserName: 'chromium' },
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'bun --no-env-file run server.js', env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:' }, url: baseURL, reuseExistingServer: false },
});
