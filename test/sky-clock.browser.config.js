import base from './world-camera.browser.config.js';
import {homedir} from 'node:os';
import {join} from 'node:path';
// Avoid an optional uninitialized node_modules/bun shim in Playwright's PATH.
const bun=process.env.HBL_BUN_BIN||join(homedir(),'.bun/bin/bun');
export default {...base,testMatch:'sky-clock.e2e.js',outputDir:'../test-results/sky-clock',webServer:{...base.webServer,command:`"${bun}" --no-env-file server.js`}};
