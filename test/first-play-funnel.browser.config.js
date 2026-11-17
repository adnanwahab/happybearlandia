import base from './two-futures-sprint.browser.config.js';

// This funnel verifies Chromium clipboard success/failure separately from the
// consumer compatibility matrix and its cross-engine device-loss scenarios.
export default {
 ...base,
 testMatch:'first-play.e2e.js',
 use:{...base.use,video:'off'},
 outputDir:'../test-results/first-play-funnel',
 webServer:{...base.webServer,env:{...base.webServer.env,
  NODE_ENV:'test',HBL_TEST_SIMULATION_PER_CLIENT:'120',HBL_TEST_SIMULATION_TOTAL:'600'}},
};
