import config from './future-machine.browser.config.js';
const port = process.env.HBL_COALITION_PORT || '39916';
const baseURL = `http://127.0.0.1:${port}`;
export default { ...config, testMatch: 'council-coalition.e2e.js', outputDir: 'test-results/council-coalition', use: { ...config.use, baseURL }, webServer: { ...config.webServer, url: baseURL + '/world/coalition/', env: { ...config.webServer.env, PORT: port } } };
