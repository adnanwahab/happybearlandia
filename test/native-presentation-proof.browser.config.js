// Native Metal proof (existing browser installation only):
// HBL_NATIVE_WEBGPU=1 HBL_BACKEND_ANGLE=metal bunx playwright test --config test/native-presentation-proof.browser.config.js
// HBL_NATIVE_PROOF_SOURCE_ROOT may point at an integration checkout: only the
// server reads that source; canonical temporary stores isolate all runtime writes.
import base from './two-futures-sprint.browser.config.js';
import {resolve} from 'node:path';
const port=process.env.HBL_NATIVE_PROOF_PORT||'39961';
const baseURL=`http://127.0.0.1:${port}`;
const args=['--enable-unsafe-swiftshader',...(process.env.HBL_NATIVE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[]),...(process.env.HBL_BACKEND_ANGLE?['--use-angle='+process.env.HBL_BACKEND_ANGLE]:[])];
export default {
 ...base,testMatch:'native-presentation-proof.e2e.js',
 outputDir:process.env.HBL_NATIVE_PROOF_ARTIFACT_DIR||resolve(process.cwd(),'test-results/native-presentation-proof'),
 webServer:{...base.webServer,cwd:resolve(process.env.HBL_NATIVE_PROOF_SOURCE_ROOT||process.cwd()),url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:port}},
 use:{...base.use,baseURL,browserName:'chromium',deviceScaleFactor:1,video:'off',launchOptions:{...base.use.launchOptions,args}},
};
