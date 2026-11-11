import { defineConfig } from '@playwright/test';
const port = process.env.HBL_VISUAL_PASS_PORT || '39885';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e',
  testMatch: ['world-visual-pass.e2e.js', 'world-visual-pass-accessibility.e2e.js'],
  workers: 1, timeout: 180000, expect: { timeout: 45000 },
  outputDir: '../test-results/world-visual-pass',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--enable-unsafe-swiftshader'] } },
  webServer: { command: 'bun --no-env-file run server.js', cwd: process.cwd(), url: baseURL,
    reuseExistingServer: false, env: { PORT: port, HBL_WORLD_DB_PATH: ':memory:' } },
});
