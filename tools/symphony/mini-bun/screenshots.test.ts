import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {validateScreenshotConfig,captureScreenshots} from './screenshots';
test('screenshot routes fail closed on external URLs and invalid route characters',()=>{
 for(const route of ['https://example.com','//example.com','/\\\\example.com','/\nheader'])expect(()=>validateScreenshotConfig({command:['bun'],paths:[route]})).toThrow();
});
test('real browser captures before and after desktop/mobile PNGs with disposable server data and cleans up',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mini-screen-test-'));
 try{
  await mkdir(path.join(dir,'fixture'));
  await writeFile(path.join(dir,'fixture/package.json'),JSON.stringify({name:'capture-fixture',version:'1.0.0',main:'index.js'}));
  await writeFile(path.join(dir,'fixture/index.js'),`export const title='Fixture UI';`);
  await writeFile(path.join(dir,'package.json'),JSON.stringify({name:'capture-test',dependencies:{'capture-fixture':'file:./fixture'},scripts:{postinstall:'touch forbidden-lifecycle-script'}}));
  const installed=Bun.spawnSync([process.execPath,'install','--ignore-scripts'],{cwd:dir});expect(installed.exitCode).toBe(0);
  await rm(path.join(dir,'node_modules'),{recursive:true,force:true});
  await writeFile(path.join(dir,'app.ts'),`import {title} from 'capture-fixture';const s=Bun.serve({port:0,hostname:'127.0.0.1',fetch:()=>new Response('<main><h1>'+title+'</h1></main>',{headers:{'content-type':'text/html'}})});console.log('running at '+s.url);`);
  const config={command:[process.execPath,'app.ts'],paths:['/'],timeoutMs:20000};
  for(const stage of ['before','after'] as const){const e=await captureScreenshots(dir,config,undefined,stage);expect(e.files).toHaveLength(2);for(const f of e.files){const b=new Uint8Array(await Bun.file(path.join(dir,f.path)).arrayBuffer());expect([...b.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10]);expect(f.path).toContain(stage);}}
  expect(await Bun.file(path.join(dir,'forbidden-lifecycle-script')).exists()).toBe(false);
  const controller=new AbortController();controller.abort();await expect(captureScreenshots(dir,config,controller.signal)).rejects.toThrow('interrupted');
 }finally{await rm(dir,{recursive:true,force:true});}
},45000);
