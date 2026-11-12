import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'browser-evidence.e2e.js', workers: 1,
  use: { browserName: 'chromium', launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    }),
  } },
});
