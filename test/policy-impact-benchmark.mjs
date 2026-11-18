import {chromium} from 'playwright';
import {createBrowserEnvironment} from './support/browser-environment.js';
import {mkdir} from 'node:fs/promises';
const app=createBrowserEnvironment({name:'policy-impact-benchmark'}),output=process.env.HBL_IMPACT_BENCH_OUTPUT||'/private/tmp/SHE-1042-benchmark';
const revision=Bun.spawnSync(['git','rev-parse','HEAD']).stdout.toString().trim();
const dirty=Bun.spawnSync(['git','status','--porcelain']).stdout.toString().trim();
await mkdir(output,{recursive:true});
const token='isolated-browser-benchmark';
const server=Bun.spawn(['bun','--no-env-file','server.js'],{cwd:process.cwd(),env:{PATH:process.env.PATH,...app.serverEnv,HBL_POLICY_PREVIEW_DIR:app.store+'/previews',HBL_POLICY_PREVIEW_ORIGIN:app.baseURL,HBL_POLICY_PREVIEW_TOKEN:token},stdout:'ignore',stderr:'pipe'});
const stderr=new Response(server.stderr).text();let browser;
try{
 let ready=false;for(let n=0;n<300;n++){try{if((await fetch(app.baseURL+'/api/health')).ok){ready=true;break;}}catch{}await Bun.sleep(100);}if(!ready)throw Error('Isolated server not ready');
 const input=await Bun.file('world/policy-preview-demo.json').json();
 const created=await(await fetch(app.baseURL+'/api/policy-previews',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(input)})).json();
 for(let n=0;n<1000;n++){const m=await(await fetch(app.baseURL+'/api/policy-previews/'+created.id)).json();if(m.job.status==='completed'){var modelVersion=m.modelVersion;break;}if(n===999)throw Error('Simulation unfinished');await Bun.sleep(100);}
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']});
 const report={commit:revision,dirty,preview:created.id,simulation:input.simulation,modelVersion,seeds:'deriveSeed(42, runIndex), indices 0..99; stored pair seeds authoritative',samples:[],limitations:'One local warm-server sample per viewport; browser memory is a snapshot, not peak; SwiftShader is not native GPU evidence.'};
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),responses=[],pending=[];
  page.on('requestfinished',r=>{if(r.url().includes('/api/policy-previews/'))pending.push(r.sizes().then(async s=>responses.push({path:new URL(r.url()).pathname+new URL(r.url()).search,bytes:s.responseBodySize,status:(await r.response()).status()})));});
  const start=performance.now();await page.goto(app.baseURL+'/world/impact?preview='+created.id);
  await page.waitForFunction(()=>window.hblPolicyImpact?.getState().selected&&document.querySelectorAll('#landscape circle').length===100,null,{timeout:90000});
  const firstUsefulMs=performance.now()-start;await Promise.all(pending);
  const session=await context.newCDPSession(page);await session.send('Performance.enable');const metrics=await session.send('Performance.getMetrics');
  const memory=Object.fromEntries(metrics.metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize'].includes(m.name)).map(m=>[m.name,m.value]));
  await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
  report.samples.push({name,firstUsefulMs,apiRequests:responses.length,apiBytes:responses.reduce((n,r)=>n+r.bytes,0),responses,memory});await context.close();
 }
 await Bun.write(output+'/receipt.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();server.kill();await server.exited;await stderr;app.dispose();}
