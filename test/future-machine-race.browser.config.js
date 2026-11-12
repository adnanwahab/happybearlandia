import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'future-machine-race-')),port='39919',baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({...canonical,testMatch:'future-machine-race.e2e.js',outputDir:process.env.HBL_FM_RACE_ARTIFACT_DIR||join(root,'artifacts'),
 use:{...canonical.use,baseURL},webServer:{...canonical.webServer,url:`${baseURL}/world/future-machine.html`,env:{PORT:port,HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DECISION_STORE_DIR:join(root,'decision')}}});
