import path from 'node:path';
import {readdir,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha256=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
/** Export only non-secret source, examples and reproducible bundles; never host state. */
export async function exportRuntime(destination:string,source=import.meta.dir){
 const output=path.resolve(destination);
 await mkdir(output,{recursive:true});if((await readdir(output)).length)throw Error('Export destination must be empty; installed runtimes are never overwritten');
 const files=(await readdir(source)).filter(name=>/\.(?:ts|js)$/.test(name)&&!name.includes('.test.')).sort();
 await mkdir(path.join(output,'source'));
 const hashes:Record<string,string>={};
 for(const file of files){const bytes=await readFile(path.join(source,file));await writeFile(path.join(output,'source',file),bytes);hashes['source/'+file]=sha256(bytes);}
 for(const [entry,name]of [['run.ts','runner.js'],['import-linear.ts','import-linear.js']] as const){
  const build=await Bun.build({entrypoints:[path.join(source,entry)],target:'bun',minify:false});
  if(!build.success)throw Error('Runtime build failed: '+build.logs.join('\n'));
  const bytes=new Uint8Array(await build.outputs[0].arrayBuffer());await writeFile(path.join(output,name),bytes);hashes[name]=sha256(bytes);
 }
 await mkdir(path.join(output,'profiles'));
 for(const file of (await readdir(path.join(source,'profiles'))).filter(name=>name.endsWith('.example.json')).sort()){
  const bytes=await readFile(path.join(source,'profiles',file));await writeFile(path.join(output,'profiles',file),bytes);hashes['profiles/'+file]=sha256(bytes);
 }
 await copyFile(path.join(source,'README.md'),path.join(output,'README.md'));
 const git=(args:string[])=>Bun.spawnSync(['git',...args],{cwd:source,stdout:'pipe',stderr:'pipe'});
 const head=git(['rev-parse','HEAD']),status=git(['status','--porcelain','--',source]);
 const manifest={schemaVersion:1,canonicalRepository:'adnanwahab/happybearlandia',sourceCommit:head.exitCode===0?head.stdout.toString().trim():null,sourceDirty:status.exitCode!==0||Boolean(status.stdout.toString().trim()),runtime:'bun',files:hashes,contentSha256:sha256(JSON.stringify(hashes))};
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(import.meta.main){const i=process.argv.indexOf('--out');if(i<0||!process.argv[i+1])throw Error('Usage: bun export-runtime.ts --out EMPTY_DIRECTORY');console.log(JSON.stringify(await exportRuntime(process.argv[i+1]),null,2));}
