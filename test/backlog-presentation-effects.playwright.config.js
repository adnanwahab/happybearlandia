import {defineConfig} from '@playwright/test';
const root=process.env.HBL_PRESENTATION_SOURCE_ROOT;
if(!root)throw Error('Set HBL_PRESENTATION_SOURCE_ROOT to integrated checkout');
export default defineConfig({testDir:'./e2e',testMatch:'backlog-presentation-effects.e2e.js',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:41873',launchOptions:{args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']}},webServer:{command:'bun run server.js',cwd:root,env:{PORT:'41873',DECISION_STORE_DIR:'/tmp/hbl-presentation-41873'},url:'http://127.0.0.1:41873/game',reuseExistingServer:false}});
