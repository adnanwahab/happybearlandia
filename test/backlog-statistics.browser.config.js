import {execFileSync} from 'node:child_process';
import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
// Serve actual coordinator source, never copy it or modify its checkout/store.
const root=resolve(process.env.HBL_STATISTICS_SOURCE_ROOT||'.');
const source=readFileSync(resolve(root,'world/decision/intelligence-view.js'),'utf8');
if(!source.includes('runHousingFactorial')||!source.includes('partialDependenceChart')) {
 throw Error('INTEGRATION-BLOCKED: source has no production statistics mount; set HBL_STATISTICS_SOURCE_ROOT to coordinator integration checkout after wiring.');
}
const store=mkdtempSync(resolve(tmpdir(),'hbl-statistics-store-'));
const port=process.env.HBL_STATISTICS_PORT||'3196';
export default defineConfig({
 metadata:{sourceRoot:root,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()},
 testDir:'.',testMatch:'backlog-statistics.browser.e2e.js',workers:1,timeout:120000,
 expect:{timeout:30000},
 outputDir:process.env.HBL_STATISTICS_OUTPUT||'/tmp/hbl-backlog-statistics-browser',
 use:{actionTimeout:15000,baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',reducedMotion:'reduce',viewport:{width:1440,height:1000},trace:'retain-on-failure',launchOptions:{args:['--disable-gpu'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})}},
 webServer:{command:'bun --no-env-file run server.js',cwd:root,env:{PORT:port,DECISION_STORE_DIR:resolve(store,'decision'),HBL_WORLD_DB_PATH:resolve(store,'world.sqlite'),HBL_CITY_DATA_DIR:resolve(store,'city'),HBL_REALITY_SHARE_DB_PATH:resolve(store,'shares.sqlite'),HBL_JOURNAL_ROOT:resolve(store,'journals')},url:`http://127.0.0.1:${port}/world/decision.html`,reuseExistingServer:false},
});
