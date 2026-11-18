import base from './launch-landing.browser.config.js';
export default {
  ...base, testMatch: 'privacy.e2e.js', outputDir: '/tmp/hbl-she965-browser',
  use: { ...base.use, video: 'off' },
  webServer: { ...base.webServer, env: { ...base.webServer.env, HBL_BIND_HOST: '127.0.0.1', HBL_SERVER_LOG_DIR: '/tmp/hbl-she965-logs' } },
};
