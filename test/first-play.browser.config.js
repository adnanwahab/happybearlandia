import {defineConfig, devices} from '@playwright/test';
import {resolve} from 'node:path';

const browsers=(process.env.HBL_FIRST_PLAY_BROWSERS ?? 'chromium').split(',');
for(const browser of browsers)if(!['chromium','firefox','webkit'].includes(browser))throw Error(`Unsupported browser: ${browser}`);
const port=process.env.HBL_FIRST_PLAY_PORT ?? '3199';
export default defineConfig({
 testDir:'./e2e',testMatch:['first-play-matrix.e2e.js','pipeline-device-loss.e2e.js'],
 outputDir:process.env.HBL_FIRST_PLAY_OUTPUT ?? '/private/tmp/hbl-first-play-results',
 metadata:{sourceRoot:resolve('.')},workers:1,timeout:120000,expect:{timeout:30000},
 reporter:[['list'],['json',{outputFile:process.env.HBL_FIRST_PLAY_REPORT ?? '/private/tmp/hbl-first-play-report.json'}]],
 projects:browsers.flatMap(browser=>[
  {name:`${browser}-desktop`,use:{browserName:browser,viewport:{width:1440,height:900}}},
  {name:`${browser}-mobile-emulation`,testMatch:'first-play-matrix.e2e.js',use:{...devices[browser==='webkit'?'iPhone 13':'Pixel 7'],browserName:browser,...(browser==='firefox'?{isMobile:false}:{})}},
 ]),
 use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{cwd:resolve('.'),command:`${process.env.HBL_BUN_EXECUTABLE ?? 'bun'} --no-env-file run server.js`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,
  env:{PORT:port,HBL_WORLD_DB_PATH:':memory:'}},
});
