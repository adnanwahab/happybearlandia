import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {validateScreenshotConfig,screenshotMarkdown,captureScreenshots} from './screenshots';
test('screenshot routes fail closed on external URLs and markdown references exact-source checks and immutable uploaded artifacts',()=>{
 for(const route of ['https://example.com','//example.com','/\\example.com','/\nheader'])expect(()=>validateScreenshotConfig({command:['bun'],paths:[route]})).toThrow();
 const md=screenshotMarkdown('fixture/repo','a'.repeat(40),{stage:'before',capturedAt:'now',files:[{path:'.mini-symphony-evidence/before-desktop-1.png',route:'/',viewport:'desktop'}]});
 expect(md).toContain('/commit/'+ 'a'.repeat(40)+'/checks');expect(md).toContain('Before browser evidence');expect(md).toContain('not proof');expect(md).not.toContain('![ ');
 const artifact=screenshotMarkdown('fixture/repo','a'.repeat(40),{capturedAt:'now',files:[],artifactURL:'https://github.com/fixture/repo/actions/runs/123/artifacts/456'});expect(artifact).toContain('Download immutable CI artifact');
 expect(()=>screenshotMarkdown('fixture/repo','a'.repeat(40),{capturedAt:'now',files:[],artifactURL:'https://elsewhere.invalid/artifact'})).toThrow();
 expect(()=>screenshotMarkdown('fixture/repo','main',{capturedAt:'now',files:[]})).toThrow();
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
  const config={command:[process.execPath,'app.ts'],paths:['/'],timeoutMs:20000};const artifacts=path.join(dir,'external-artifacts');
  for(const stage of ['before','after'] as const){const e=await captureScreenshots(dir,config,undefined,stage,'SHE-1',artifacts);expect(e.files).toHaveLength(2);for(const f of e.files){const b=new Uint8Array(await Bun.file(path.join(artifacts,path.basename(f.path))).arrayBuffer());expect([...b.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10]);expect(f.path).toContain(stage);expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);expect(f.path).toContain(f.sha256!);}}
  expect(await Bun.file(path.join(dir,'forbidden-lifecycle-script')).exists()).toBe(false);expect(await Bun.file(path.join(dir,'.mini-symphony-evidence/SHE-1-before.json')).exists()).toBe(false);
  const controller=new AbortController();controller.abort();await expect(captureScreenshots(dir,config,controller.signal)).rejects.toThrow('interrupted');
 }finally{await rm(dir,{recursive:true,force:true});}
},45000);
