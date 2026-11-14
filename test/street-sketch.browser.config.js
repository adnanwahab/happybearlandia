import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: /(?:street-sketch|city-invention)\.e2e\.js/, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3199', browserName: 'chromium' },
  webServer: { command: `${process.env.HBL_BUN || 'bun'} run server.js`, cwd: new URL('..', import.meta.url).pathname, env: { PORT: '3199' }, url: 'http://127.0.0.1:3199/world/invention/', reuseExistingServer: false } });
