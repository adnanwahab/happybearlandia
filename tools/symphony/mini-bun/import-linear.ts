import path from 'node:path';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { readProject, validateProjectTasks, validateBinding, projectBinding, githubIdentity } from './project';
import { fetchProjectIssues, importProjectTasks } from './linear-import';
const args = process.argv.slice(2), idx = args.indexOf('--config');
if (idx < 0 || !args[idx + 1]) throw Error('Usage: bun import-linear.ts --config profile.json [--write]');
const project = readProject(args[idx + 1]);
const origin = Bun.spawnSync(['git','-C',project.repository,'remote','get-url','origin'], { stdout:'pipe', stderr:'pipe' });
if (origin.exitCode !== 0 || githubIdentity(origin.stdout.toString()) !== project.githubRepository.toLowerCase()) throw Error('Repository origin differs from profile');
const root = project.dataDirectory, binding = path.join(root,'project-binding.json');
if (await Bun.file(binding).exists()) validateBinding(await Bun.file(binding).json(),project);
const tasksPath = path.join(root,'tasks.json'), statePath = path.join(root,'state.json');
const oldTasksText = await Bun.file(tasksPath).exists() ? await readFile(tasksPath,'utf8') : null;
const oldTasks = oldTasksText === null ? [] : JSON.parse(oldTasksText);
validateProjectTasks(oldTasks,project);
const oldStateText = await Bun.file(statePath).exists() ? await readFile(statePath,'utf8') : null;
const oldState = oldStateText === null ? {} : JSON.parse(oldStateText);
const issues = await fetchProjectIssues(project,process.env.LINEAR_API_KEY ?? '');
const prResult = Bun.spawnSync(['gh','pr','list','--repo',project.githubRepository,'--state','open','--limit','1000','--json','headRefName,title,body,state,url'], { stdout:'pipe', stderr:'pipe' });
if (prResult.exitCode !== 0) throw Error('Could not check existing PRs; queue was not changed');
const imported = importProjectTasks(project,issues,JSON.parse(prResult.stdout.toString()),oldTasks,oldState);
validateProjectTasks(imported.tasks,project);
if (args.includes('--write')) {
  await mkdir(root,{recursive:true});
  const lock = path.join(root,'.runner.lock');
  try { await mkdir(lock); } catch { throw Error('Stop this project runner before refreshing its queue'); }
  try {
    await writeFile(path.join(lock,'pid'),String(process.pid));
    for (const [file,before] of [[tasksPath,oldTasksText],[statePath,oldStateText]] as const) {
      const current = await Bun.file(file).exists() ? await readFile(file,'utf8') : null;
      if (current !== before) throw Error('Project queue/state changed during refresh; retry without overwriting it');
    }
    for (const [file,value] of [[binding,projectBinding(project)],[tasksPath,imported.tasks],[statePath,imported.state]] as const) {
      const tmp = `${file}.${crypto.randomUUID()}.tmp`;await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,file);
    }
  } finally { await import('node:fs/promises').then(fs=>fs.rm(lock,{recursive:true,force:true})); }
}
console.log(JSON.stringify({project:project.name,issues:issues.length,enabled:imported.tasks.filter(t=>t.enabled).length,dependencyCheckFailures:imported.tasks.filter(t=>t.dependencyError).length,projectPrerequisiteHolds:imported.tasks.filter(t=>t.disabledReason==='project_prerequisite').length,written:args.includes('--write')},null,2));
