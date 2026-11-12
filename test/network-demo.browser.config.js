import base from './two-futures-sprint.browser.config.js';
import {join} from 'node:path';
export default {...base,testMatch:['network-demo.e2e.js'],outputDir:process.env.HBL_NETWORK_ARTIFACT_DIR||join(process.cwd(),'test-results/network-demo')};
