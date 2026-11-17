import base from './two-futures-sprint.browser.config.js';
export default {...base, use:{...base.use,hasTouch:true}, testMatch:['surprise-wonder.e2e.js'], webServer:{...base.webServer,command:`${process.env.HBL_BUN_EXECUTABLE || 'bun'} --no-env-file run server.js`}, outputDir:'test-results/surprise-wonder'};
