import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'newspaper-editor.browser.js',
  use: { baseURL: 'http://127.0.0.1:41713' },
  webServer: { cwd: process.cwd(), command: 'bun --no-env-file run server.js', env: { PORT: '41713', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:41713/world/causal.html' },
});
