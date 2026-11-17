import {defineConfig} from '@playwright/test';
const port = process.env.HBL_CHANGELOG_PORT || '31921';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./e2e', testMatch:'changelog.e2e.js', workers:1,
  timeout:30000, use:{baseURL,browserName:'chromium',trace:'retain-on-failure'},
  webServer:{command:'bun run server.js',cwd:new URL('..',import.meta.url).pathname,env:{PORT:port,HBL_RELEASE_DB_PATH:'.hbl-city/changelog-test.sqlite'},url:baseURL+'/tools/release-changelog.html',reuseExistingServer:false},
});
