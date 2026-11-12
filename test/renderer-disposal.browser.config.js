import {defineConfig} from '@playwright/test';
import base from './future-machine.browser.config.js';
const baseURL='http://127.0.0.1:39979';
export default defineConfig({...base,testMatch:'renderer-disposal.e2e.js',timeout:240000,
 outputDir:process.env.HBL_DISPOSAL_ARTIFACT_DIR||'/private/tmp/hbl-renderer-disposal',
 use:{...base.use,baseURL,video:'off'},
 webServer:{...base.webServer,url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:'39979'},command:`${process.env.HBL_BUN_EXECUTABLE||'bun'} --no-env-file run server.js`},
});
