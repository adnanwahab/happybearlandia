import config from './future-machine.browser.config.js';
export default { ...config, testMatch: 'onboarding-experiment.e2e.js', outputDir: 'test-results/onboarding-experiment', use: { ...config.use, baseURL: 'http://127.0.0.1:39925' }, webServer: { ...config.webServer, url: 'http://127.0.0.1:39925/', env: { ...config.webServer.env, PORT: '39925' } } };
