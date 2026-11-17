import {join} from 'node:path';
import config from './future-machine.browser.config.js';
export default {...config,testMatch:'school-run.e2e.js',outputDir:join(process.cwd(),'test-results/school-run')};
