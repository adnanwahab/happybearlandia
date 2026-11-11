import base from './future-machine.browser.config.js';
const port=process.env.HBL_RESEARCH_PORT||'41983',baseURL=`http://127.0.0.1:${port}`;
export default {
 ...base,testMatch:'research-scene.e2e.js',
 outputDir:'/private/tmp/hbl-research-scene',
 use:{...base.use,baseURL,video:'off'},
 webServer:{...base.webServer,url:baseURL+'/world/future-machine.html',env:{...base.webServer.env,PORT:port}},
};
