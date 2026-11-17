import {defineConfig} from '@playwright/test';
import base from './startup-smoke.config.js';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

// bunx prepends node_modules/.bin, which can contain an uninitialized Bun shim.
const installedBun=join(homedir(),'.bun','bin','bun');
const bun=process.env.HBL_BUN_EXECUTABLE||(existsSync(installedBun)?installedBun:'bun');

export default defineConfig({...base,
  testMatch:'regression-gallery.gallery.js',
  timeout:120000,
  retries:0,
  use:{...base.use,hasTouch:true},
  outputDir:process.cwd()+'/test-results/regression-gallery/artifacts',
  reporter:[['list'],['./e2e/gallery/reporter.js']],
  webServer:{...base.webServer,command:`'${bun.replaceAll("'","'\\''")}' --no-env-file run server.js`},
});
