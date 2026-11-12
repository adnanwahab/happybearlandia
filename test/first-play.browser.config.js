import base from './two-futures-sprint.browser.config.js';
export default {...base, testMatch:'first-play.e2e.js', use:{...base.use, video:'off'}, outputDir:'../test-results/first-play'};
