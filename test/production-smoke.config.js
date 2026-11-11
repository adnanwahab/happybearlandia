import { defineConfig } from '@playwright/test';

const baseURL = process.env.HBL_SMOKE_URL;
if (!baseURL || !/^https?:\/\//.test(baseURL)) throw new Error('Set HBL_SMOKE_URL to the deployed app URL.');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './production',
  testMatch: 'release-smoke.js',
  use: { baseURL, launchOptions: executablePath ? { executablePath } : {} },
});
