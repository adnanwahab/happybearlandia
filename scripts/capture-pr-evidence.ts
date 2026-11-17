// CI-only visual smoke evidence. Do not commit the images to task branches.
import path from 'node:path';
import {readFile,appendFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {captureScreenshots} from '../tools/symphony/mini-bun/screenshots.ts';

const headRoot=path.resolve(import.meta.dir,'..');
const baseRoot=path.resolve(headRoot,'../baseline');
const project=JSON.parse(await readFile(path.join(headRoot,'tools/symphony/mini-bun/hbl.project.json'),'utf8'));
if(!project.screenshots)throw Error('Project screenshot profile is missing');
const taskId='pr-'+String(process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8')).pull_request?.number ?? 'manual' : 'manual');
if(!/^pr-[0-9]+$/.test(taskId))throw Error('Expected a pull-request number');
const before=await captureScreenshots(baseRoot,project.screenshots,undefined,'before',taskId);
const after=await captureScreenshots(headRoot,project.screenshots,undefined,'after',taskId);
if(before.files.length!==after.files.length||before.files.length!==project.screenshots.paths.length*2)throw Error('Incomplete screenshots');
const output=path.join(headRoot,'test-results','pr-screenshots');
for(const [stage,root,evidence] of [['before',baseRoot,before],['after',headRoot,after]] as const){
 const folder=path.join(output,stage);
 await mkdir(folder,{recursive:true});
 for(const file of evidence.files){
  if(!/^\\.mini-symphony-evidence\\/pr-[0-9]+-(?:before|after)-(?:desktop|mobile)-[12]\\.png$/.test(file.path))
   throw Error('Unsafe screenshot artifact path');
  await copyFile(path.join(root,file.path),path.join(folder,path.basename(file.path)));
 }
 await writeFile(path.join(output,stage+'.json'),JSON.stringify(evidence,null,2)+'\\n');
}
const summary='### PR Playwright evidence (observational)\n\n' +
  '- Exact base and head checked out separately\n' +
  '- Before captures: '+before.files.length+'\n' +
  '- After captures: '+after.files.length+'\n' +
  '- Download the \`pr-screenshots-...\` artifact from this run to compare PNG files and manifests.\n' +
  '- These screenshots are visual smoke evidence, not acceptance or a required merge gate.\n';
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
console.log('Captured '+before.files.length+' before and '+after.files.length+' after screenshots for '+taskId);
