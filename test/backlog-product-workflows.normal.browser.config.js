import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=mkdtempSync(join(tmpdir(),'hbl-product-normal-'));
const source=process.env.HBL_PRODUCT_SOURCE_ROOT||'/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia';
const port=process.env.HBL_PRODUCT_NORMAL_PORT||'39982';
export default defineConfig({testDir:'.',testMatch:'backlog-product-workflows.normal.browser.spec.js',workers:1,timeout:90000,outputDir:'/tmp/hbl-product-normal-proof',use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium'},webServer:{command:'bun --no-env-file run server.js',cwd:source,url:`http://127.0.0.1:${port}/world/decision.html`,env:{PORT:port,HBL_WORKFLOW_STORE_DIR:join(root,'workflows'),HBL_LOCAL_CAPABILITY_KEY_PATH:join(root,'capability/key'),HBL_CHECKPOINT_STORE_DIR:join(root,'checkpoints'),HBL_WORLD_DB_PATH:join(root,'world.sqlite'),HBL_CITY_DATA_DIR:join(root,'city'),HBL_REALITY_SHARE_DB_PATH:join(root,'shares.sqlite'),DECISION_STORE_DIR:join(root,'decision')}}});
