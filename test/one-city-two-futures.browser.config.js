// Keep existing sprint regressions and add the issue's explicit acceptance journey.
import canonical from './two-futures-sprint.browser.config.js';
export default {
 ...canonical,
 testMatch:[...canonical.testMatch,'one-city-two-futures.e2e.js'],
 use:{...canonical.use,viewport:{width:1440,height:900},video:{mode:'on',size:{width:1440,height:900}},trace:'on'},
 // One isolated server serves many independent journeys from the same socket
 // address. Keep admission enabled, with an explicit test-only batch budget.
 webServer:{...canonical.webServer,command:'bun --no-env-file run start',env:{...canonical.webServer.env,
  NODE_ENV:'test',HBL_TEST_SIMULATION_PER_CLIENT:'120',HBL_TEST_SIMULATION_TOTAL:'600'}},
};
