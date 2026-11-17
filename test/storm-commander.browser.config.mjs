import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: 'storm-commander.e2e.js', workers: 1,
  outputDir: '/private/tmp/SHE-691-browser',
  use: { baseURL: 'http://127.0.0.1:35191', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  webServer: { cwd: process.cwd(), command: 'bun --no-env-file run server.js', env: { PORT: '35191', HBL_WORLD_DB_PATH: ':memory:' }, url: 'http://127.0.0.1:35191' } });
