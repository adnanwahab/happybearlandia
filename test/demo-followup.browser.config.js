// bunx playwright test --config test/demo-followup.browser.config.js
// Optional HBL_DEMO_FOLLOWUP_PORT / HBL_DEMO_FOLLOWUP_ARTIFACT_DIR / HBL_DEMO_FOLLOWUP_ENGINE.
import base from './two-futures-sprint.browser.config.js';
import {join} from 'node:path';
const port=process.env.HBL_DEMO_FOLLOWUP_PORT||'39951';
const baseURL=`http://127.0.0.1:${port}`;
const engine=process.env.HBL_DEMO_FOLLOWUP_ENGINE||'chromium';
if(!['chromium','firefox','webkit'].includes(engine))throw new Error(`Unsupported engine: ${engine}`);
export default {...base,testMatch:['demo-followup.e2e.js','canvas-followup.e2e.js'],outputDir:process.env.HBL_DEMO_FOLLOWUP_ARTIFACT_DIR||join(process.cwd(),'test-results/demo-followup'),webServer:{...base.webServer,url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:port}},use:{...base.use,baseURL,browserName:engine,video:'off',...(engine==='chromium'?{}:{launchOptions:{}})}};
