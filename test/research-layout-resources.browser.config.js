import base from './research-scene.browser.config.js';
const port=process.env.HBL_RESEARCH_LAYOUT_PORT||'41985',baseURL=`http://127.0.0.1:${port}`;
export default {
 ...base,testMatch:'research-layout-resources.e2e.js',outputDir:'/private/tmp/hbl-research-layout-resources',
 use:{...base.use,baseURL,reducedMotion:'reduce'},
 webServer:{...base.webServer,url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:port}},
};
