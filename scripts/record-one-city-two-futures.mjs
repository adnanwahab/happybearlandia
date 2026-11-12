#!/usr/bin/env bun
/**
 * Record the canonical, real-time Play Demo acceptance journey.
 * From any directory:
 *   bun /path/to/happybearlandia/scripts/record-one-city-two-futures.mjs
 * Optional: --output /absolute/artifacts --port 39941
 * Environment: HBL_TWO_FUTURES_ARTIFACT_DIR, HBL_TWO_FUTURES_PORT,
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (forwarded to the canonical config).
 * A successful exit means the acceptance test completed; inspect its output
 * directory for the browser video, screenshots, timing and evidence JSON.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const usage='Usage: bun scripts/record-one-city-two-futures.mjs [--output DIRECTORY] [--port PORT]';
const args=process.argv.slice(2);
let output=process.env.HBL_TWO_FUTURES_ARTIFACT_DIR||resolve(root,'test-results/one-city-two-futures-recording');
let port=process.env.HBL_TWO_FUTURES_PORT||'39931';
try {
 for(let i=0;i<args.length;i++) {
  const key=args[i];
  if(key==='--help'||key==='-h'){console.log(usage);process.exit(0);}
  if(!['--output','--port'].includes(key))throw new Error(`Unknown argument: ${key}`);
  const value=args[++i];
  if(!value||value.startsWith('--'))throw new Error(`Missing value for ${key}`);
  if(key==='--output')output=value;else port=value;
 }
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('Port must be an integer from 1 through 65535.');
 output=resolve(process.cwd(),output);
 console.log(`Recording real Play Demo via the canonical acceptance suite. Artifacts: ${output}`);
 const child=spawn('bunx',['playwright','test','--config','test/one-city-two-futures.browser.config.js','--grep','record real'],{
  cwd:root,stdio:'inherit',env:{...process.env,HBL_RECORD_DEMO:'1',HBL_TWO_FUTURES_ARTIFACT_DIR:output,HBL_TWO_FUTURES_PORT:port},
 });
 const result=await new Promise((resolveResult,reject)=>{
  child.once('error',reject);
  child.once('exit',(code,signal)=>resolveResult({code,signal}));
 });
 if(result.code!==0)throw new Error(`Recording acceptance did not complete successfully (${result.signal?`signal ${result.signal}`:`exit ${result.code}`}). Review Playwright output and artifacts at ${output}.`);
 console.log(`Recording acceptance passed. Review browser video and evidence at ${output}.`);
} catch(error) {
 console.error(`${error.message}\n${usage}`);
 process.exitCode=1;
}
