import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: 'museum.e2e.js', workers: 1, use: { baseURL: 'http://127.0.0.1:39876' }, webServer: { command: 'python3 -m http.server 39876 --bind 127.0.0.1', url: 'http://127.0.0.1:39876/world/museum/', reuseExistingServer: false } });
