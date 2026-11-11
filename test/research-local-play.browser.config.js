import base from './research-scene.browser.config.js';
const port=process.env.HBL_RESEARCH_LOCAL_PLAY_PORT||'41987',baseURL=`http://127.0.0.1:${port}`;
export default {
 ...base,testMatch:'research-local-play.e2e.js',outputDir:'/private/tmp/hbl-research-local-play',
 use:{...base.use,baseURL,reducedMotion:'reduce'},
 webServer:{...base.webServer,url:baseURL+'/world/',env:{...base.webServer.env,PORT:port}},
};
