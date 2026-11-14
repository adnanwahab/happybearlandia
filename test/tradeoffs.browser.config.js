import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const store=mkdtempSync(join(tmpdir(),'hbl-tradeoffs-'));
export default defineConfig({testDir:'./e2e',testMatch:'tradeoffs.e2e.js',workers:1,timeout:90000,use:{baseURL:'http://127.0.0.1:43159',channel:'chrome',launchOptions:{args:['--use-angle=metal']},reducedMotion:'reduce'},webServer:{cwd:process.cwd(),command:'bun --no-env-file server.js',url:'http://127.0.0.1:43159/world/decision.html',env:{PORT:'43159',DECISION_STORE_DIR:join(store,'decision'),HBL_WORLD_DB_PATH:join(store,'world.sqlite'),HBL_CITY_DATA_DIR:join(store,'city')}}});
