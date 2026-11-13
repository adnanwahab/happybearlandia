export type Command = (bin: string, args: string[], cwd: string) => { code: number; stdout: string; stderr: string };

// Each step can be repeated after a crash without requiring a dirty worktree.
export function publishDraft(command: Command, workspace: string, id: string, base: string, title: string, body: string, onResult?: (result: {url: string; reused: boolean}) => void) {
  const run = (bin: string, args: string[]) => {
    const result = command(bin, args, workspace);
    if (result.code !== 0) throw Error(`${bin} ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
    return result.stdout.trim();
  };
  const branch = `mini/${id}`;
  if (run('git', ['branch', '--show-current']) !== branch) throw Error(`Expected branch ${branch}`);
  run('gh', ['auth', 'status', '-h', 'github.com']);
  const existing = JSON.parse(run('gh', ['pr', 'list', '--state', 'all', '--head', branch, '--base', base, '--json', 'url,state,headRefName,baseRefName']));
  if (!Array.isArray(existing) || existing.length > 1) throw Error('Ambiguous existing pull requests');
  if (existing.length) {
    const pr = existing[0];
    if (pr.headRefName !== branch || pr.baseRefName !== base || !/^https:\/\/github\.com\//.test(pr.url)) throw Error('Invalid existing pull request');
    if (pr.state === 'CLOSED') throw Error('Existing pull request was closed without merging; review before retry');
    if (!['OPEN', 'MERGED'].includes(pr.state)) throw Error('Unknown pull request state');
    if (run('git', ['status', '--porcelain'])) throw Error('Existing PR has additional local edits; review before publication');
    const remote = run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s/)[0];
    const local = run('git', ['rev-parse', 'HEAD']);
    // A merged branch may have been deleted; its PR remains authoritative delivery evidence.
    if (pr.state === 'OPEN' && remote !== local) throw Error('Existing PR head differs from local commit; review before publication');
    onResult?.({url: pr.url, reused: true});
    return pr.url as string;
  }
  if (run('git', ['status', '--porcelain'])) {
    run('git', ['add', '-A']);
    run('git', ['commit', '-m', `Mini Symphony: ${id}`]);
  }
  const ref = `refs/remotes/origin/${base}`;
  // Compare against the current server base, not a stale worktree tracking ref.
  run('git', ['fetch', '--no-tags', 'origin', `refs/heads/${base}:${ref}`]);
  run('git', ['rev-parse', '--verify', ref]);
  if (Number(run('git', ['rev-list', '--count', `${ref}..HEAD`])) === 0 ||
      !run('git', ['diff', '--name-only', `${ref}...HEAD`])) throw Error('Codex exited successfully but produced no changes to publish');
  run('git', ['push', '-u', 'origin', branch]);
  const url = run('gh', ['pr', 'create', '--draft', '--base', base, '--head', branch, '--title', title, '--body', body]).split('\n').at(-1)!;
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url)) throw Error('Invalid draft PR creation response; retry to reconcile');
  onResult?.({url, reused: false});
  return url;
}
