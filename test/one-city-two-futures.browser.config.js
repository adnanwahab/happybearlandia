// Keep existing sprint regressions and add the issue's explicit acceptance journey.
import canonical from './two-futures-sprint.browser.config.js';
export default {
 ...canonical,
 testMatch:[...canonical.testMatch,'one-city-two-futures.e2e.js'],
 use:{...canonical.use,viewport:{width:1440,height:900},video:{mode:'on',size:{width:1440,height:900}},trace:'on'},
 webServer:{...canonical.webServer,command:'bun --no-env-file run start'},
};
