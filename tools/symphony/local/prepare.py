#!/usr/bin/env python3
"""Trusted before_run baseline preflight; never run inside the model sandbox."""
from pathlib import Path
import shutil
import sys
import json
import re

import handoff
import host_git as h
import publish as p


def clone_check(path, root=p.ROOT):
    if (not re.fullmatch(r'SHE-[1-9][0-9]*', path.name) or path.is_symlink() or
            path.absolute() != root.resolve() / path.name or path.resolve() != path.absolute()):
        raise p.PublicationError('Fresh workspace must be a canonical isolated issue child')
    if any(path.iterdir()):
        raise p.PublicationError('Refusing to overwrite nonempty workspace')
    h.assignment(path.name)
    return {'status': 'clone-authorized', 'issue': path.name}


def prepare(path, root=p.ROOT):
    issue = p.validate(path, root)
    terminal = p.STATE / 'workpad-status' / (issue + '.json')
    if terminal.exists() and handoff.read(terminal).get('status') == 'handoff':
        raise p.PublicationError('Terminal handoff retained; host recovery or explicit reviewed resume required, never another model')
    if handoff.pending(path, 'publish').exists():
        raise p.PublicationError('Completed source handoff retained; host publisher recovery required, never launch another model')
    # No checkout/reset/clean, including for existing dirty workspaces.
    branch = 'symphony/' + issue
    if (path / '.git/HEAD').read_text().strip() != 'ref: refs/heads/' + branch:
        raise p.PublicationError('Host must create exact issue branch before worker startup')
    repo = h.Repository(path, issue)
    ref = path / '.git/refs/heads' / branch
    if not ref.is_file() or ref.read_text().strip() != repo.policy['baseCommit']:
        raise p.PublicationError('Workspace baseline is not the approved host baseline; preserve and reconcile')
    gh = shutil.which('gh', path=p.TRUSTED_PATH)
    if not gh:
        raise p.PublicationError('Missing trusted GitHub authentication tool')
    p.command([gh, 'auth', 'status'], repo.root, repo.env)
    from repository_routes import verify_source
    verify_source(repo.policy, lambda endpoint: json.loads(p.command([gh, 'api', endpoint], repo.root, repo.env)))
    repo.fetch_base(gh)
    repo.changes()  # Reject unrelated tracked/untracked edits without deleting them.
    directory = handoff.directory(path)
    handoff.snapshot(directory, 'base.json', json.dumps({'issue': issue, 'baseCommit': repo.policy['baseCommit'],
                                                       'files': repo.policy['files'], 'branch': branch, 'base': repo.policy['base'], 'repository': repo.policy['repository']}) + '\n')
    # Host-only metadata edit; model writes remain protected by workspace-write.
    excludes = path / '.git/info/exclude'
    old = excludes.read_text() if excludes.exists() else ''
    if '.hbl-handoff/' not in old.splitlines():
        excludes.write_text(old + '\n.hbl-handoff/\n')
    return {'status': 'prepared', 'issue': issue, 'baseCommit': repo.policy['baseCommit']}


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--clone-route']:
            clone_check(Path.cwd())
            policy = h.assignment(Path.cwd().name)
            print('https://github.com/' + policy['repository'] + '.git')
            print(policy['base'])
        else:
            print(clone_check(Path.cwd()) if sys.argv[1:] == ['--clone-check'] else prepare(Path.cwd()))
    except Exception as error:
        print(str(error) if isinstance(error, p.PublicationError) else 'Host preflight failed; preserve workspace and reconcile', file=sys.stderr)
        sys.exit(1)
