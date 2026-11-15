import config from './future-machine.browser.config.js';
export default {...config,testMatch:'postcards.e2e.js',outputDir:'test-results/postcards',use:{...config.use,baseURL:'http://127.0.0.1:39942'},webServer:{...config.webServer,url:'http://127.0.0.1:39942/routes',env:{...config.webServer.env,PORT:'39942'}}};
