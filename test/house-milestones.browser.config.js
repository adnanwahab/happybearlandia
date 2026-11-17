import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'she559-'));
export default defineConfig({testDir:'./e2e',testMatch:'house-milestones.e2e.js',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:41859',browserName:'chromium',reducedMotion:'reduce',launchOptions:{args:['--enable-unsafe-swiftshader']}},webServer:{cwd:process.cwd(),command:'bun --no-env-file run server.js',url:'http://127.0.0.1:41859/world/government/index.html',env:{PORT:'41859',HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_REALITY_SHARE_DB_PATH:join(root,'reality.sqlite'),HBL_JOURNAL_ROOT:join(root,'journals'),DECISION_STORE_DIR:join(root,'decision')},reuseExistingServer:false}});
