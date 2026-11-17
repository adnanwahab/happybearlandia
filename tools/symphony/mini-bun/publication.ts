export type Command = (bin: string, args: string[], cwd: string) => { code: number; stdout: string; stderr: string };

// Each step can be repeated after a crash without requiring a dirty worktree.
// Historical export name retained. Trusted caller policy defaults to regular PRs.
export type PublicationOptions = {draft?: boolean};
export function publishDraft(command: Command, workspace: string, id: string, base: string, title: string, body: string | ((head:string)=>string), onResult?: (result: {url: string; reused: boolean}) => void, options: PublicationOptions = {}) {
  if (!options || typeof options !== 'object' || (options.draft !== undefined && typeof options.draft !== 'boolean')) throw Error('Invalid publication policy');
  const draft = options.draft ?? false;
  const run = (bin: string, args: string[]) => {
    const result = command(bin, args, workspace);
    if (result.code !== 0) throw Error(`${bin} ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
    return result.stdout.trim();
  };
  const sourcePaths=['.',':(exclude).mini-symphony-evidence/**',':(exclude)artifacts/mini-symphony/**',':(top,exclude)tasks.json',':(top,exclude)state.json',':(top,exclude)project-binding.json',':(top,exclude).runner.lock/**'];
  const sourceStatus=()=>run('git',['status','--porcelain','--',...sourcePaths]);
  const branch = `mini/${id}`;
  if (run('git', ['branch', '--show-current']) !== branch) throw Error(`Expected branch ${branch}`);
  run('gh', ['auth', 'status', '-h', 'github.com']);
  const existing = JSON.parse(run('gh', ['pr', 'list', '--state', 'all', '--head', branch, '--base', base, '--json', 'url,state,headRefName,baseRefName,isDraft,headRefOid,isCrossRepository']));
  if (!Array.isArray(existing) || existing.length > 1) throw Error('Ambiguous existing pull requests');
  if (existing.length) {
    const pr = existing[0];
    if (pr.headRefName !== branch || pr.baseRefName !== base || !/^https:\/\/github\.com\//.test(pr.url)) throw Error('Invalid existing pull request');
    if (draft && pr.state === 'MERGED') throw Error('Merged PR cannot satisfy draft publication policy; review required');
    if (pr.state === 'CLOSED') throw Error('Existing pull request was closed without merging; review before retry');
    if (!['OPEN', 'MERGED'].includes(pr.state)) throw Error('Unknown pull request state');
    if (pr.isCrossRepository !== false) throw Error('Existing PR is not a verified same-repository delivery');
    if (sourceStatus()) throw Error('Existing PR has additional local edits; review before publication');
    const remote = run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s/)[0];
    const local = run('git', ['rev-parse', 'HEAD']);
    // A merged branch may have been deleted; its PR remains authoritative delivery evidence.
    if (pr.state === 'OPEN' && (remote !== local || pr.headRefOid !== local)) throw Error('Existing PR head differs from local commit; review before publication');
    if (pr.state === 'OPEN') {
      if (typeof pr.isDraft !== 'boolean') throw Error('Existing PR draft status is unavailable; retry before publication');
      // Reconcile only this exact clean task. Worker prompts cannot choose mode.
      const fresh = () => {
        const value = JSON.parse(run('gh', ['pr', 'view', pr.url, '--json', 'state,isDraft,headRefName,baseRefName,headRefOid,isCrossRepository']));
        if (value.state !== 'OPEN' || value.headRefName !== branch || value.baseRefName !== base || value.isCrossRepository !== false || value.headRefOid !== local || typeof value.isDraft !== 'boolean') throw Error('Existing draft identity or head changed before publication; review before publication');
        return value;
      };
      const current = fresh();
      if (current.isDraft !== draft) {
        // Recheck local/origin ownership immediately before the remote mutation.
        if (sourceStatus() || run('git', ['rev-parse', 'HEAD']) !== local || run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s/)[0] !== local) throw Error('Publication head changed before mode update');
        run('gh', ['pr', 'ready', pr.url, ...(draft ? ['--undo'] : [])]);
        if (fresh().isDraft !== draft) throw Error('PR publication mode did not persist; retry before publication');
      }
    }
    onResult?.({url: pr.url, reused: true});
    return pr.url as string;
  }
  if (sourceStatus()) {
    run('git', ['add', '-A', '--', ...sourcePaths]);
    const staged=run('git',['diff','--cached','--name-only']).split('\n').filter(Boolean);
    if(staged.some(file=>file.startsWith('.mini-symphony-evidence/')||file.startsWith('artifacts/mini-symphony/')||['tasks.json','state.json','project-binding.json'].includes(file)||file.startsWith('.runner.lock/')))throw Error('Browser evidence must remain outside feature commits; preserve staged work for review');
    if(!staged.length)throw Error('Codex produced only local browser artifacts; no source changes to publish');
    run('git', ['commit', '-m', `Mini Symphony: ${id}`]);
  }
  const ref = `refs/remotes/origin/${base}`;
  // Compare against the current server base, not a stale worktree tracking ref.
  run('git', ['fetch', '--no-tags', 'origin', `refs/heads/${base}:${ref}`]);
  run('git', ['rev-parse', '--verify', ref]);
  if (Number(run('git', ['rev-list', '--count', `${ref}..HEAD`])) === 0 ||
      !run('git', ['diff', '--name-only', `${ref}...HEAD`])) throw Error('Codex exited successfully but produced no changes to publish');
  run('git', ['push', '-u', 'origin', branch]);
  const url = run('gh', ['pr', 'create', ...(draft ? ['--draft'] : []), '--base', base, '--head', branch, '--title', title, '--body', typeof body==='function'?body(run('git',['rev-parse','HEAD'])):body]).split('\n').at(-1)!;
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url)) throw Error('Invalid PR creation response; retry to reconcile');
  if (draft) {
    const value = JSON.parse(run('gh', ['pr', 'view', url, '--json', 'state,isDraft,headRefName,baseRefName,headRefOid,isCrossRepository']));
    const local = run('git', ['rev-parse', 'HEAD']);
    if (value.state !== 'OPEN' || value.isDraft !== true || value.headRefName !== branch || value.baseRefName !== base || value.headRefOid !== local || value.isCrossRepository !== false || sourceStatus() || run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s/)[0] !== local) throw Error('Created draft identity, mode or head differs; retry to reconcile');
  }
  onResult?.({url, reused: false});
  return url;
}
