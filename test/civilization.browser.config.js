import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:54388';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['houston-map.e2e.js', 'emergent-civilizations.e2e.js', 'playable-life.e2e.js', 'city-invention.e2e.js', 'hidden-systems.e2e.js', 'learning-civilization.e2e.js', 'sculpt-a-storm.e2e.js', 'connected-lives.e2e.js', 'release-journey.e2e.js'],
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    browserName: 'chromium',
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      ...(executablePath && { executablePath }),
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'bun --no-env-file run server.js',
    env: { PORT: '54388', HBL_WORLD_DB_PATH: ':memory:' },
    url: baseURL,
    reuseExistingServer: false,
  },
});
