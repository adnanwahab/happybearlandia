// bunx playwright test --config test/approved-demo-responsive.browser.config.js
// Optional HBL_RESPONSIVE_SOURCE_ROOT reads another integration checkout.
// Runtime stores always come from the canonical isolated temporary directory.
import base from './two-futures-sprint.browser.config.js';
import {resolve} from 'node:path';
const port=process.env.HBL_RESPONSIVE_PORT||'39962';
const baseURL=`http://127.0.0.1:${port}`;
export default {
 ...base,testMatch:'approved-demo-responsive.e2e.js',
 outputDir:process.env.HBL_RESPONSIVE_ARTIFACT_DIR||resolve(process.cwd(),'test-results/approved-demo-responsive'),
 webServer:{...base.webServer,cwd:resolve(process.env.HBL_RESPONSIVE_SOURCE_ROOT||process.cwd()),url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:port}},
 use:{...base.use,baseURL,reducedMotion:'reduce',video:'off'},
};
