import base from './research-scene.browser.config.js';
const port=process.env.HBL_RESEARCH_DIRECTORY_PORT||'41986',baseURL=`http://127.0.0.1:${port}`;
export default {
 ...base,testMatch:'research-directory.e2e.js',outputDir:'/private/tmp/hbl-research-directory',
 use:{...base.use,baseURL,reducedMotion:'reduce'},
 webServer:{...base.webServer,url:baseURL+'/routes',env:{...base.webServer.env,PORT:port}},
};
