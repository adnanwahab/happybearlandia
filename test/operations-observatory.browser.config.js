import { defineConfig } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'hbl-operations-browser-'));
const fixture = JSON.parse(readFileSync('test/fixtures/operations-observatory.json', 'utf8'));
for (const panel of Object.values(fixture)) if (panel && typeof panel === 'object') panel.observedAt = new Date().toISOString();
writeFileSync(join(root, 'evidence.json'), JSON.stringify(fixture));
writeFileSync(join(root, 'coordinator.json'), JSON.stringify({ scannedAt: Date.now() / 1000, issues: [{ identifier: 'SHE-202', eligible: false, reasons: ['Synthetic dependency hold: SHE-180'] }] }));
const port = process.env.HBL_OPERATIONS_BROWSER_PORT || '55382';
export default defineConfig({
  testDir: './e2e', testMatch: 'operations-observatory.e2e.js', workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }) } },
  webServer: { command: 'bun --no-env-file run server.js', cwd: process.cwd(), url: `http://127.0.0.1:${port}/api/health`, reuseExistingServer: false,
    env: { PORT: port, HBL_BUILD_ID: 'abcdef123', HBL_WORLD_DB_PATH: ':memory:', DECISION_STORE_DIR: join(root, 'decision'), HBL_REALITY_SHARE_DB_PATH: join(root, 'shares.sqlite'), HBL_CITY_DATA_DIR: join(root, 'city'), HBL_OPERATIONS_EVIDENCE_PATH: join(root, 'evidence.json'), HBL_OPERATIONS_COORDINATOR_PATH: join(root, 'coordinator.json') } },
});
