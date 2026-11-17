import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Inherited by workers so lifecycle fixtures edit only this disposable server's DB.
process.env.HBL_REPLAY_AUDIT_STORE ||= mkdtempSync(join(tmpdir(),'hbl-replay-audit-'));
const store=process.env.HBL_REPLAY_AUDIT_STORE;
const port=process.env.HBL_REPLAY_AUDIT_PORT||'39946';
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./e2e',testMatch:'scenario-replay-audit.e2e.js',workers:1,
 timeout:180000,expect:{timeout:30000},outputDir:join(store,'artifacts'),
 use:{baseURL,browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure',
  launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}},
 webServer:{command:'bun --no-env-file run server.js',cwd:process.cwd(),url:baseURL,
  reuseExistingServer:false,env:{PORT:port,HBL_WORLD_DB_PATH:join(store,'world.sqlite'),
   HBL_CITY_DATA_DIR:join(store,'city'),HBL_REALITY_SHARE_DB_PATH:join(store,'shares.sqlite'),DECISION_STORE_DIR:join(store,'decision')}},
});
