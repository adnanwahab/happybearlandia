import canonical from './two-futures-sprint.browser.config.js';

// Dedicated Worker 6 gate. Real server and disposable stores come from the
// canonical config; retain successful evidence as well as failed runs.
export default {
 ...canonical,
 testMatch: ['one-city-two-futures.e2e.js'],
 use: {...canonical.use, viewport:{width:1440,height:900},
  video:{mode:'on',size:{width:1440,height:900}}, trace:'on'},
};
