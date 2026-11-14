import { defineConfig } from '@playwright/test';
const port = process.env.HBL_PLAYWRIGHT_PORT || '3194';
export default defineConfig({
  testDir: './e2e', testMatch: 'decision-edit-history.e2e.js', workers: 1, timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium',
    launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--enable-unsafe-swiftshader'] } },
  webServer: { command: 'bun run server.js', cwd: process.cwd(), url: `http://127.0.0.1:${port}/world/decision.html`,
    env: { PORT: port, DECISION_STORE_DIR: `/tmp/hbl-she471-${port}` }, reuseExistingServer: false },
});
