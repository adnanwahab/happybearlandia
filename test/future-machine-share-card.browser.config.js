import {defineConfig} from '@playwright/test';
import canonical from './future-machine.browser.config.js';
export default defineConfig({...canonical,testMatch:'future-machine-share-card.e2e.js',use:{...canonical.use,baseURL:'http://127.0.0.1:39947'},webServer:{...canonical.webServer,url:'http://127.0.0.1:39947/world/future-machine.html',env:{...canonical.webServer.env,PORT:'39947'}}});
