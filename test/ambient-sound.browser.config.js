import base from './startup-smoke.config.js';
export default {...base, webServer:{...base.webServer,command:`${process.env.HOME}/.bun/bin/bun --no-env-file run server.js`}, testMatch:'ambient-sound.e2e.js', outputDir:'test-results/ambient-sound',reporter:'list'};
