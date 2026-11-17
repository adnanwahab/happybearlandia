import base from './world-visual-pass.browser.config.js';
export default {...base,webServer:{...base.webServer,command:`${process.env.HOME}/.bun/bin/bun --no-env-file run server.js`},testMatch:['population-zoom.e2e.js'],outputDir:'../test-results/she747'};
