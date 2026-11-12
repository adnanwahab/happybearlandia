import base from './future-machine.browser.config.js';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const port=process.env.HBL_SYMPHONY_UNBLOCK_PORT||'39983';
const baseURL=`http://127.0.0.1:${port}`;
export default {...base,testMatch:'symphony-unblock.e2e.js',outputDir:process.env.HBL_SYMPHONY_UNBLOCK_ARTIFACT_DIR||join(tmpdir(),'hbl-symphony-unblock'),use:{...base.use,baseURL},webServer:{...base.webServer,url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:port}}};
