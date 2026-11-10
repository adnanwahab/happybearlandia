import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'causality-inspector.e2e.js',use:{baseURL:'http://127.0.0.1:39871'},webServer:{command:process.env.HBL_FULL_SERVER?'bun run server.js':'bun test/causality-browser-server.js',env:{PORT:'39871'},cwd:new URL('..',import.meta.url).pathname,url:'http://127.0.0.1:39871/world/causality/inspect.html'}});
