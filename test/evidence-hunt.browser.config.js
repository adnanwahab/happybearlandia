import config from './civilization.browser.config.js';
export default {...config, testMatch:'evidence-hunt.e2e.js',
  use:{...config.use,baseURL:'http://127.0.0.1:44714'},
  webServer:{...config.webServer,env:{...config.webServer.env,PORT:'44714'},url:'http://127.0.0.1:44714'}};
