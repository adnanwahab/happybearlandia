import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const port=process.env.HBL_PRODUCT_TEST_PORT||'39981';
export default defineConfig({testDir:'.',testMatch:'backlog-product-workflows.browser.spec.js',workers:1,outputDir:process.env.HBL_PRODUCT_ARTIFACTS||'/tmp/hbl-product-workflow-proof',use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',headless:true},webServer:{cwd:new URL('../',import.meta.url).pathname,command:'bun world/decision/backlog-product-workflows/harness.js',url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{HBL_PRODUCT_TEST_PORT:port,HBL_PRODUCT_TEST_STORE:mkdtempSync(join(tmpdir(),'hbl-product-browser-proof-'))}}});
