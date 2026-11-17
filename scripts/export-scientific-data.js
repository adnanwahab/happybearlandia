import { mkdir, readFile, writeFile, rename, rm, mkdtemp } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createScientificExport, fileHash } from '../shared/scientific-export/index.js';

export async function exportScientificDataCLI(args, {stderr = text => process.stderr.write(text)} = {}) {
  let staging;
  try {
    if (args.length < 2 || args.length > 3 || !['all','json-csv'].includes(args[2] ?? 'all')) throw new Error('Usage: bun scripts/export-scientific-data.js <run-receipt.json> <new-directory> [all|json-csv]');
    const output = resolve(args[1]);
    const bundle = await createScientificExport(JSON.parse(await readFile(args[0],'utf8')));
    await mkdir(dirname(output),{recursive:true});
    staging = await mkdtemp(join(dirname(output),'.scientific-export-'));
    for (const [name,content] of Object.entries(bundle.files)) await writeFile(join(staging,name),content);
    if ((args[2] ?? 'all') === 'all') {
      const helper = fileURLToPath(new URL('./scientific-parquet.py',import.meta.url));
      const result = spawnSync('python3',[helper,join(staging,'metrics.json'),join(staging,'metrics.parquet')],{encoding:'utf8'});
      if (result.status !== 0) throw new Error('Parquet encoder failed. Install scripts/scientific-export-requirements.txt with Python pip. '+(result.error?.message ?? result.stderr));
      bundle.manifest.files['metrics.parquet'] = {sha256:await fileHash(await readFile(join(staging,'metrics.parquet')))};
    }
    await writeFile(join(staging,'manifest.json'),JSON.stringify(bundle.manifest,null,2)+'\n');
    // mkdir fails for any existing destination, including empty directories/symlinks.
    await mkdir(output);
    try { await rename(staging,output); } catch(error) { await rm(output,{recursive:true}); throw error; }
    staging = null;
    return 0;
  } catch(error) {stderr(`Scientific export failed: ${error.message}\n`);return 1;}
  finally {if(staging) await rm(staging,{recursive:true,force:true});}
}
if (import.meta.main) process.exitCode = await exportScientificDataCLI(process.argv.slice(2));
