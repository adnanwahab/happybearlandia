// Acceptance: bunx playwright test --config test/one-city-two-futures.browser.config.js
// Recording: bun scripts/record-one-city-two-futures.mjs --output /tmp/two-futures-recording
// The canonical suite owns server isolation, browser settings and artifact policy.
export { default } from './two-futures-sprint.browser.config.js';
