import base from './future-machine.browser.config.js';
const baseURL = 'http://127.0.0.1:39940';
export default {
  ...base,
  use: { ...base.use, baseURL },
  webServer: { ...base.webServer, url: baseURL, env: { ...base.webServer.env, PORT: '39940' }, command: `${process.env.HBL_PERF_BUN || 'bun'} --no-env-file run server.js` },
  testMatch: 'first-interaction-budget.e2e.js',
  timeout: 300000,
  outputDir: process.cwd() + '/test-results/first-interaction',
  reporter: [['list'], ['json', { outputFile: process.cwd() + '/test-results/first-interaction/results.json' }]],
};
