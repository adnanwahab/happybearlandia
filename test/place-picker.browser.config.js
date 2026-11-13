import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'place-picker.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:49186'},webServer:{cwd:process.cwd(),command:`PORT=49186 ${process.env.HOME}/.bun/bin/bun run server.js`,url:'http://127.0.0.1:49186/world',timeout:60000}});
