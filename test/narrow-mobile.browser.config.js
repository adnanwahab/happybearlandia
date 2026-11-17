import base from './activity-first-run-followup.browser.config.js';
const port=process.env.HBL_NARROW_MOBILE_PORT||'41978';
const baseURL=`http://127.0.0.1:${port}`;
export default {
 ...base,testMatch:'narrow-mobile.e2e.js',outputDir:'test-results/narrow-mobile',
 use:{...base.use,baseURL},
 webServer:{...base.webServer,url:baseURL+'/world/',env:{...base.webServer.env,PORT:port}},
};
