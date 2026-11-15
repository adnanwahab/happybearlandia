import base from './future-machine.browser.config.js';
export default {...base,testMatch:'future-machine-watch-party.e2e.js',webServer:{...base.webServer,env:{...base.webServer.env,HBL_FUTURE_WATCH_LOCAL:'1'}}};
