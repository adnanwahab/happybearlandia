// bun scripts/benchmark-gpu-reproducibility.js [output.json]
// Opens an isolated headless Chrome profile; does not use the user's browser.
import { VERSION, workload, oracle, measure } from '../world/gpu-reproducibility.js';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
const output = process.argv[2] || '/tmp/hbl-gpu-reproducibility.json';
let resolve;
const done = new Promise(r=>resolve=r);
const machine={platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model};
const cpuRows=[];
for(const seed of [0,42,2911]) { const input=workload(seed); cpuRows.push(await measure(input,'cpu',()=>oracle(input))); }
let server;
try { server = Bun.serve({hostname:'127.0.0.1',port:0,async fetch(req) {
  const url = new URL(req.url);
  if (url.pathname === '/result' && req.method === 'POST') { resolve(await req.json()); return new Response('ok'); }
  if (url.pathname === '/') return new Response(`<!doctype html><script type="module">
    import {VERSION,BACKENDS,workload,oracle,gpuRunner,measure} from '/world/gpu-reproducibility.js';
    const report={version:VERSION,userAgent:navigator.userAgent,rows:[],adapters:[],errors:[]};
    try {
      for (const seed of [0,42,2911]) { const input=workload(seed); report.rows.push(await measure(input,'cpu',()=>oracle(input))); }
      // Requests may select the same physical adapter; record this rather than imply distinct hardware.
      for (const powerPreference of ['low-power','high-performance']) {
        const adapter=await navigator.gpu?.requestAdapter({powerPreference});
        if (!adapter) { report.adapters.push({powerPreference,status:'unavailable'}); continue; }
        const limits={}; for(const key in adapter.limits) if(typeof adapter.limits[key]==='number') limits[key]=adapter.limits[key];
        const record={powerPreference,info:adapter.info ? {vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter} : null,limits};
        report.adapters.push(record);
        const device=await adapter.requestDevice();
        device.addEventListener('uncapturederror',event=>report.errors.push(event.error.message));
        try { for(const seed of [0,42,2911]) for(const backend of BACKENDS) {
          const input=workload(seed), start=performance.now(); const runner=await gpuRunner(device,input,backend);
          const setupMs=performance.now()-start;
          try { const row=await measure(input,backend,()=>runner.run()); const cpu=report.rows.find(r=>r.backend==='cpu' && r.seed===seed); report.rows.push({...row,powerPreference,setupMs,medianVsCpu:row.medianMs/cpu.medianMs}); } finally { runner.destroy(); }
        }} finally { device.destroy(); }
      }
    } catch(error) { report.errors.push(String(error.stack||error)); }
    await fetch('/result',{method:'POST',body:JSON.stringify(report)});
  </script>`,{headers:{'Content-Type':'text/html'}});
  if (!['/world/gpu-reproducibility.js','/world/reproducibility.js'].includes(url.pathname)) return new Response('missing',{status:404});
  return new Response(Bun.file('.'+url.pathname));
}});
} catch(error) {
  await Bun.write(output,JSON.stringify({version:VERSION,recordedAt:new Date().toISOString(),machine,rows:cpuRows,adapters:[],errors:[`Local browser server unavailable: ${error.message}`]},null,2)+'\n');
  console.error('Browser measurement unavailable; CPU evidence saved to '+output);
  process.exit(1);
}
const profile=await mkdtemp('/tmp/hbl-gpu-');
let chrome;
try {
  chrome=Bun.spawn([process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--no-first-run',`--user-data-dir=${profile}`,`http://127.0.0.1:${server.port}`],{stdout:'ignore',stderr:'pipe'});
  const timeout=setTimeout(()=>resolve({version:VERSION,errors:['Browser measurement timed out'],rows:[]}),120000);
  const report=await Promise.race([done,chrome.exited.then(code=>({version:VERSION,errors:[`Chrome exited ${code}: adapter measurements unavailable`],rows:[]}))]);
  clearTimeout(timeout);
  report.machine=machine;
  if(!report.rows?.length) report.rows=cpuRows;
  report.recordedAt=new Date().toISOString();
  await Bun.write(output,JSON.stringify(report,null,2)+'\n');
  console.log(output);
  if(report.errors?.length || !report.rows?.some(r=>r.backend!=='cpu') || report.rows.some(r=>!r.accepted)) process.exitCode=1;
} finally { chrome?.kill(); server.stop(true); await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100}); }
