import config from './civilization.browser.config.js';
export default {
  ...config,
  testMatch: ['hidden-systems.e2e.js'],
  use: { ...config.use, baseURL: 'http://127.0.0.1:55420' },
  webServer: { ...config.webServer, env: { ...config.webServer.env, PORT: '55420' }, url: 'http://127.0.0.1:55420' },
};
