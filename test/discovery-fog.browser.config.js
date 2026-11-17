import base from './world-visual-pass.browser.config.js';
export default {...base,testMatch:['discovery-fog.e2e.js'],outputDir:'../test-results/discovery-fog',webServer:{...base.webServer,command:`${process.env.HBL_BUN_BIN || 'bun'} --no-env-file run server.js`}};
