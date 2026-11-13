import type { Command } from './publication';

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
