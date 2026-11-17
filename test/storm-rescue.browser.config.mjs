import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: 'storm-rescue.e2e.js', workers: 1,
  use: { baseURL: 'http://127.0.0.1:35178', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  webServer: { command: 'bun --no-env-file run server.js', env: { PORT: '35178', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:35178' } });
