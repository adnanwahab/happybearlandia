import {test,expect} from 'bun:test';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {exportRuntime} from './export-runtime';
test('canonical runtime exports rebuildable non-secret source with verified bundles and stable hashes',async()=>{
 const a=await mkdtemp(join(tmpdir(),'mini-export-a-')),b=await mkdtemp(join(tmpdir(),'mini-export-b-'));
 try{
  const first=await exportRuntime(a),second=await exportRuntime(b);
  expect(first.contentSha256).toBe(second.contentSha256);
  for(const [name,hash]of Object.entries(first.files))expect(createHash('sha256').update(await readFile(join(a,name))).digest('hex')).toBe(hash);
  const names=Object.keys(first.files);expect(names).toContain('source/run.ts');expect(names).toContain('runner.js');expect(names).toContain('import-linear.js');expect(names.some(n=>/tasks.json|state.json|\.env|hbl.project|\.test\./.test(n))).toBe(false);
  expect((await readdir(a)).sort()).toEqual(['README.md','import-linear.js','manifest.json','profiles','runner.js','source']);
  const rebuilt=await Bun.build({entrypoints:[join(a,'source/run.ts')],target:'bun'});expect(rebuilt.success).toBe(true);
  const before=await readFile(join(a,'runner.js'),'utf8');await expect(exportRuntime(a)).rejects.toThrow('must be empty');expect(await readFile(join(a,'runner.js'),'utf8')).toBe(before);
 }finally{await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true});}
});
