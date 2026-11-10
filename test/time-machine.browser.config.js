import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:39876';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['world-time-machine.browser.js', 'bakery-mystery.e2e.js', 'living-city.e2e.js'],
  use: { baseURL },
  webServer: {
    command: 'bun run server.js',
    cwd: process.cwd(),
    env: { PORT: '39876', HBL_WORLD_DB_PATH: ':memory:' },
    url: baseURL + '/world/causal.html',
  },
});
