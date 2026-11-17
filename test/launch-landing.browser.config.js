import { join } from 'node:path';
import base from './two-futures-sprint.browser.config.js';

export default {
  ...base,
  testMatch: ['launch-landing.e2e.js'],
  outputDir: join(process.cwd(), 'test-results/launch-landing'),
  // Three fresh visitors share one loopback client in this isolated test process.
  // Keep production admission unchanged; rate-limit behavior has its own tests.
  webServer: {
    ...base.webServer,
    env: { ...base.webServer.env, NODE_ENV: 'test', HBL_TEST_SIMULATION_PER_CLIENT: '24' },
  },
};
