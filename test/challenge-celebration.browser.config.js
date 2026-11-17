import config from './future-machine.browser.config.js';
export default {...config,testMatch:'challenge-celebration.e2e.js',outputDir:'test-results/challenge-celebration',webServer:{...config.webServer,command:`${process.env.HBL_BUN_EXECUTABLE || 'bun'} --no-env-file run server.js`}};
