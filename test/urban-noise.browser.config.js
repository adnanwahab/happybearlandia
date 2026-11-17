import base from './startup-smoke.config.js';
export default {...base,webServer:{...base.webServer,command:`${process.env.HOME}/.bun/bin/bun --no-env-file run server.js`},testMatch:'urban-noise.e2e.js',outputDir:'test-results/urban-noise',reporter:'list'};
