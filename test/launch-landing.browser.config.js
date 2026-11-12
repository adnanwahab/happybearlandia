import { join } from 'node:path';
import base from './two-futures-sprint.browser.config.js';
export default { ...base, testMatch: ['launch-landing.e2e.js'], outputDir: join(process.cwd(), 'test-results/launch-landing') };
