import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
const baseURL='http://127.0.0.1:39963';
export default defineConfig({...canonical,testMatch:'first-play-diagnostics.e2e.js',use:{...canonical.use,baseURL},webServer:{...canonical.webServer,url:baseURL+'/world/future-machine.html',env:{...canonical.webServer.env,PORT:'39963'}}});
