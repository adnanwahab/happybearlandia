import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
const port='39948',baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({...canonical,testMatch:'future-machine-copy.e2e.js',use:{...canonical.use,baseURL},webServer:{...canonical.webServer,url:baseURL+'/world/future-machine.html',env:{...canonical.webServer.env,PORT:port}}});
