import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'evidence-trail-real-')),sourceRoot='/Users/wahabma/happybearlandia',port='39927',baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({...canonical,testMatch:'evidence-trail-real.e2e.js',outputDir:process.env.HBL_TRAIL_ARTIFACT_DIR||join(root,'artifacts'),use:{...canonical.use,baseURL},
 webServer:{...canonical.webServer,cwd:sourceRoot,url:`${baseURL}/world/future-machine.html`,env:{PORT:port,HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DECISION_STORE_DIR:join(root,'decision')}}});
