import base from './first-run.browser.config.js';
export default{...base,testDir:'./support',testMatch:'browser-isolation.fixture.js',
 globalSetup:'./support/browser-global-setup.js',reporter:'line',
 outputDir:process.env.HBL_BROWSER_ISOLATION_ARTIFACTS,
 metadata:{...base.metadata,runId:process.env.HBL_BROWSER_ISOLATION_ID},
 webServer:{...base.webServer,command:'bun --no-env-file test/support/browser-isolation-server.js',url:base.use.baseURL,
  env:{...base.webServer.env,HBL_BROWSER_ISOLATION_ID:process.env.HBL_BROWSER_ISOLATION_ID}}};
