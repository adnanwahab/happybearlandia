import base from './two-futures-sprint.browser.config.js';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
const port = process.env.HBL_SMALL_SCREEN_PORT || '39978';
const baseURL = `http://127.0.0.1:${port}`;

export default {
  ...base,
  webServer: {...base.webServer, command: `${process.env.HBL_BUN_EXECUTABLE || join(homedir(), '.bun/bin/bun')} --no-env-file run server.js`, url:baseURL+'/world/future-machine.html', env:{...base.webServer.env, PORT:port}},
  testMatch: 'small-screen-game.e2e.js',
  outputDir: resolve('test-results/small-screen-game'),
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}',
  expect: {...base.expect, toHaveScreenshot: {animations: 'disabled', maxDiffPixels: 0}},
  use: {...base.use, baseURL, hasTouch: true, reducedMotion: 'reduce', video: 'off'},
};
