#!/usr/bin/env bun
/**
 * Record the canonical, real-time Play Demo acceptance journey.
 * From any directory:
 *   bun /path/to/happybearlandia/scripts/record-one-city-two-futures.mjs
 * Optional: --output /absolute/artifacts --port 39941
 * Environment: HBL_TWO_FUTURES_ARTIFACT_DIR, HBL_TWO_FUTURES_PORT,
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (forwarded to the canonical config).
 * Requires ffprobe on PATH (FFmpeg). A successful exit means the acceptance
 * test completed and its uncut video decoded successfully; inspect its output
 * directory for the browser video, screenshots, timing and evidence JSON.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { readdir, stat, writeFile } from 'node:fs/promises';

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
 const child=spawn('bunx',['playwright','test','--config','test/one-city-two-futures.browser.config.js','--grep','SHE-71'],{
  cwd:root,stdio:'inherit',env:{...process.env,HBL_RECORD_DEMO:'1',HBL_TWO_FUTURES_ARTIFACT_DIR:output,HBL_TWO_FUTURES_PORT:port},
 });
 const result=await new Promise((resolveResult,reject)=>{
  child.once('error',reject);
  child.once('exit',(code,signal)=>resolveResult({code,signal}));
 });
 if(result.code!==0)throw new Error(`Recording acceptance did not complete successfully (${result.signal?`signal ${result.signal}`:`exit ${result.code}`}). Review Playwright output and artifacts at ${output}.`);
 // Playwright closes its context before exiting, so videos are finalized here.
 const files=[];
 async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await walk(path);else files.push(path);}}
 await walk(output);
 for(const name of ['scenario.json','metrics.json','month-0.png','first-divergence.png','why-open.png','canvas2d.png','trace.zip']){
  if(!files.some(path=>path.endsWith('/'+name)))throw new Error(`Missing required recording artifact: ${name}`);
 }
 const videos=files.filter(path=>path.endsWith('.webm'));
 if(!videos.length)throw new Error('Acceptance exited successfully but no finalized WebM video exists.');
 const verified=[];
 for(const path of videos){
  if((await stat(path)).size===0)throw new Error(`Empty video: ${path}`);
  const probe=spawn('ffprobe',['-v','error','-count_frames','-show_entries','format=duration:stream=codec_type,nb_read_frames','-of','json',path],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';probe.stdout.on('data',chunk=>stdout+=chunk);probe.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((done,reject)=>{probe.once('error',reject);probe.once('exit',done);});
  if(code!==0)throw new Error(`Video decode failed: ${path}: ${stderr}`);
  const metadata=JSON.parse(stdout),duration=Number(metadata.format?.duration);
  if(!(duration>0)||!metadata.streams?.some(stream=>stream.codec_type==='video'&&Number(stream.nb_read_frames)>0))throw new Error(`No playable video frames: ${path}`);
  verified.push({path,durationSeconds:duration});
 }
 await writeFile(join(output,'recording-manifest.json'),JSON.stringify({schemaVersion:'she71-recording.v1',verifiedAt:new Date().toISOString(),videos:verified,files},null,2));
 console.log(`Recording acceptance passed; decoded ${verified.length} playable video(s). Evidence: ${output}`);
} catch(error) {
 console.error(`${error.message}\n${usage}`);
 process.exitCode=1;
}
