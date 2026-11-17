import type { Command } from './publication';
import {existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';

/** Move an existing nested workspace without discarding edits or branch history. */
export function resolveTaskWorkspace(command:Command,repo:string,legacyRoot:string,workspaceRoot:string,id:string) {
  const workspace=path.join(workspaceRoot,id),legacy=path.join(legacyRoot,id);
  if(existsSync(workspace)||!existsSync(legacy))return workspace;
  mkdirSync(workspaceRoot,{recursive:true});
  const moved=command('git',['worktree','move',legacy,workspace],repo);
  if(moved.code!==0)throw Error(`Could not move existing worktree ${legacy} outside the source repository; it remains intact: ${(moved.stderr||moved.stdout).trim()}`);
  return workspace;
}

// Only new worktrees use a fresh base; resumed worktrees retain their edits.
export function createTaskWorkspace(command: Command, repo: string, workspace: string, id: string, base: string) {
  const run = (args: string[]) => {
    const result = command('git', args, repo);
    if (result.code !== 0) throw Error(`git ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
    return result.stdout.trim();
  };
  const ref = `refs/remotes/origin/${base}`;
  run(['fetch', '--no-tags', 'origin', `refs/heads/${base}:${ref}`]);
  const commit = run(['rev-parse', '--verify', `${ref}^{commit}`]);
  run(['worktree', 'add', '-b', `mini/${id}`, workspace, commit]);
  return commit;
}
