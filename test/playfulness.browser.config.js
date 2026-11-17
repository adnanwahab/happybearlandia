import config from './future-machine.browser.config.js';
export default {...config, testMatch:'playfulness.e2e.js', outputDir:'test-results/playfulness', use:{...config.use, baseURL:'http://127.0.0.1:39987'}, webServer:{...config.webServer,url:'http://127.0.0.1:39987/world',env:{...config.webServer.env,PORT:'39987'}}};
