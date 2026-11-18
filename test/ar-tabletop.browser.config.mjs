import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const root=mkdtempSync(join(tmpdir(),'hbl-ar-'));
export default defineConfig({testDir:'./e2e',testMatch:'ar-tabletop.e2e.js',workers:1,use:{baseURL:`http://127.0.0.1:${port}`,channel:'chrome'},webServer:{cwd:process.cwd(),command:`${process.env.HOME}/.bun/bin/bun --no-env-file server.js`,url:`http://127.0.0.1:${port}/api/health`,env:{PORT:String(port),HBL_WORLD_DB_PATH:join(root,'world.sqlite'),DECISION_STORE_DIR:join(root,'decision'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_JOURNAL_ROOT:join(root,'journals')}}});
