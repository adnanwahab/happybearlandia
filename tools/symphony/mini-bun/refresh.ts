import path from 'node:path';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import type { Project } from './project';
import { validateProjectTasks } from './project';
import { importProjectTasks } from './linear-import';

// The live runner owns state. Refresh only the task file and merge verified
// external PR receipts into its current in-memory state without replacing it.
export async function refreshRunningProject(project: Project, state: Record<string,any>, scan: () => Promise<{issues:any[];prs:any[]}>) {
  const file=path.join(project.dataDirectory,'tasks.json');
  const before=await readFile(file,'utf8');
  const oldTasks=JSON.parse(before);validateProjectTasks(oldTasks,project);
  const snapshot=await scan();
  if (await readFile(file,'utf8')!==before) throw Error('Task queue changed during Linear refresh; retry on next poll');
  const result=importProjectTasks(project,snapshot.issues,snapshot.prs,oldTasks,structuredClone(state));
  validateProjectTasks(result.tasks,project);
  const tmp=`${file}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(tmp,JSON.stringify(result.tasks,null,2)+'\n',{mode:0o600});
    if(await readFile(file,'utf8')!==before) throw Error('Task queue changed during Linear refresh; retry on next poll');
    await rename(tmp,file);
  } finally {await unlink(tmp).catch(()=>{});}
  for(const [id,entry] of Object.entries(result.state)) {
    if(entry.importedExistingPullRequest && !['running','publishing'].includes(state[id]?.status)) state[id]={...state[id],...entry};
  }
  return {issues:snapshot.issues.length,enabled:result.tasks.filter(t=>t.enabled).length};
}
