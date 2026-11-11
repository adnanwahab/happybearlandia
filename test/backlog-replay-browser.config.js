import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const source = resolve(process.env.HBL_REPLAY_SOURCE_ROOT || process.cwd());
const require = createRequire(join(source, 'package.json'));
const { defineConfig } = require('@playwright/test');
const storage = process.env.HBL_REPLAY_ACCEPTANCE_STORE || mkdtempSync(join(tmpdir(), 'hbl-replay-browser-'));
process.env.HBL_REPLAY_SOURCE_ROOT = source;
process.env.HBL_REPLAY_ACCEPTANCE_STORE = storage;
const port = process.env.HBL_REPLAY_PORT || '3479';
export default defineConfig({
  testDir: '.', testMatch: 'backlog-replay-endpoint.e2e.js', workers: 1, timeout: 180000,
  outputDir: join(storage, 'artifacts'), reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', reducedMotion: 'reduce', trace: 'retain-on-failure' },
  webServer: {
    command: `bun run ${JSON.stringify(join(source, 'server.js'))}`,
    cwd: source, url: `http://127.0.0.1:${port}/game`, reuseExistingServer: false,
    env: { PORT: port, DECISION_STORE_DIR: join(storage, 'decisions'), HBL_WORLD_DB_PATH: join(storage, 'world.sqlite'), HBL_WORKFLOW_STORE_DIR: join(storage, 'workflows'), HBL_CHECKPOINT_STORE_DIR: join(storage, 'checkpoints'), HBL_LOCAL_CAPABILITY_KEY_PATH: join(storage, 'local-key') },
  },
});
