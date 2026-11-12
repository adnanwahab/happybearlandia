"""Host-owned exact-file staging. Never execute this module inside a worker."""
import hashlib
import math
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import time
import tempfile
import shlex
import shutil

import handoff
import publish as p
from coordinator_host import private_directory

SHA = re.compile(r'[0-9a-f]{40}')
SECRET = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|lin_api_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})\b')
MAX_FILE = 16 * 1024 * 1024


def atomic(path, value):
    fd, temporary = tempfile.mkstemp(prefix='.host-', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, sort_keys=True, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def safe_name(name):
    if not isinstance(name, str) or not name or any(c in name for c in '\\*?[]') or any(ord(c) < 32 for c in name):
        return False
    parts = PurePosixPath(name).parts
    if str(PurePosixPath(name)) != name or name.startswith('/') or '..' in parts:
        return False
    if any(c.lower() in {'.git', '.hbl-handoff', '.aws', '.ssh', '.codex', '.agents', '.gitmodules', '.netrc', '.git-credentials'} for c in parts):
        return False
    return not any(c.lower().startswith('.env') and c.lower() != '.env.example' for c in parts)


def assignment(issue):
    if not isinstance(issue, str) or not re.fullmatch(r'SHE-[1-9][0-9]*', issue):
        raise p.PublicationError('ASSIGNMENT_UNSAFE: canonical issue identifier required')
    directory = p.STATE / 'assignments'
    if directory.is_symlink() or p.STATE.is_symlink():
        raise p.PublicationError('ASSIGNMENT_UNSAFE: Host assignment directory must not be a symlink')
    target = directory / (issue + '.json')
    try:
        fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd) as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1 or info.st_size > 65536:
                raise ValueError('unsafe policy')
            value = json.load(stream)
    except FileNotFoundError:
        raise p.PublicationError('ASSIGNMENT_MISSING: Missing or unsafe host-owned assignment; operator must review exact file scope') from None
    except (OSError, ValueError):
        raise p.PublicationError('ASSIGNMENT_UNSAFE: Missing or unsafe host-owned assignment; operator must review exact file scope') from None
    return validate_assignment(value, issue)


def validate_assignment(value, issue, now=None):
    """One shared admission/publisher contract; does not infer operator authority."""
    now = time.time() if now is None else now
    try:
        bounded = len((json.dumps(value, sort_keys=True, indent=2)+'\n').encode()) <= 65536
    except (TypeError, ValueError):
        bounded = False
    from repository_routes import approved_route
    try:
        route = approved_route(value.get('repository') if isinstance(value, dict) else None, p.STATE)
    except Exception:
        raise p.PublicationError('ASSIGNMENT_UNSAFE: repository routing needs private operator approval') from None
    files = value.get('files') if isinstance(value, dict) else None
    if (not isinstance(issue, str) or not re.fullmatch(r'SHE-[1-9][0-9]*', issue) or
            not bounded or not isinstance(value, dict) or type(value.get('version')) is not int or value['version'] != 1 or
            value.get('issue') != issue or value.get('repository') != route['repository'] or value.get('base') != route['base'] or
            not SHA.fullmatch(str(value.get('baseCommit', ''))) or
            not isinstance(files, list) or not files or len(files) > 100 or
            any(not isinstance(f, str) or not safe_name(f) for f in files) or len(set(files)) != len(files) or
            not isinstance(value.get('reviewedBy'), str) or not value['reviewedBy'].strip() or
            type(value.get('expiresAt')) not in (int, float) or not math.isfinite(value['expiresAt'])):
        raise p.PublicationError('ASSIGNMENT_UNSAFE: Invalid or expired host assignment; never infer scope from worker input')
    if not now < value['expiresAt'] <= now + 86400:
        raise p.PublicationError('ASSIGNMENT_EXPIRED: Invalid or expired host assignment; never infer scope from worker input')
    return value


def environment():
    # Do not let repository Git config, hooks, filters, signing, helpers or env
    # variables participate. gh uses the existing host Keychain, outside agents.
    env = {k: v for k, v in os.environ.items() if k in {'PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT'}}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0',
               GIT_AUTHOR_NAME='HappyBearLandia host publisher', GIT_COMMITTER_NAME='HappyBearLandia host publisher',
               GIT_AUTHOR_EMAIL='host-publisher@users.noreply.github.com', GIT_COMMITTER_EMAIL='host-publisher@users.noreply.github.com')
    env['PATH'] = p.TRUSTED_PATH
    return env


class Repository:
    def __init__(self, path, issue):
        self.path, self.issue = Path(path), issue
        self.policy = assignment(issue)
        private_directory(p.STATE)
        private_directory(p.STATE / 'host-git')
        self.root = p.STATE / 'host-git' / issue
        private_directory(self.root)
        self.gitdir = self.root / 'repository.git'
        self.env = environment()
        if self.gitdir.is_symlink():
            raise p.PublicationError('Unsafe host Git directory')
        if not self.gitdir.exists():
            p.command(['git', '-c', 'core.hooksPath=/dev/null', 'init', '--bare', str(self.gitdir)], self.root, self.env)
        # Worker clones remain independent. Only trusted host storage uses a
        # read-only object alternate; no workspace config or hooks are loaded.
        (self.gitdir / 'objects/info/alternates').write_text(str(self.path / '.git/objects') + '\n')
        self.env.update(GIT_DIR=str(self.gitdir), GIT_WORK_TREE=str(self.path), GIT_INDEX_FILE=str(self.root / 'index'))
        self.excludes = self.root / 'excludes'
        self.excludes.write_text('.hbl-handoff/\n')

    def git(self, *args, data=None):
        command = ['/usr/bin/git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
                   '-c', 'commit.gpgSign=false', '-c', 'core.excludesFile=' + str(self.excludes), *args]
        if data is None:
            return p.command(command, self.root, self.env)
        result = subprocess.run(command, cwd=self.root, env=self.env, input=data, capture_output=True, timeout=120)
        if result.returncode:
            raise p.PublicationError('Host Git object write failed; preserved snapshot can be retried')
        return result.stdout.decode('ascii').strip()

    def fetch_base(self, ghbin):
        self.git('-c', 'credential.helper=', '-c', 'credential.helper=!' + shlex.quote(ghbin) + ' auth git-credential',
                 'fetch', '--no-tags', 'https://github.com/' + self.policy['repository'] + '.git', self.policy['base'])
        if self.git('rev-parse', 'FETCH_HEAD') != self.policy['baseCommit']:
            raise p.PublicationError('Approved sprint baseline advanced; preserve worker changes and obtain reviewed revalidation')

    def recheck(self):
        if assignment(self.issue) != self.policy or self.policy.get('publishEnabled') is not True:
            raise p.PublicationError('Host assignment revoked or changed during publication; snapshot preserved')

    def changes(self):
        self.git('read-tree', self.policy['baseCommit'])
        tracked = self.git('diff', '--name-only', '--no-ext-diff', '--no-textconv', '-z', self.policy['baseCommit'], '--').split('\0')
        untracked = self.git('ls-files', '--others', '--exclude-standard', '-z').split('\0')
        names = sorted(set(tracked + untracked) - {''})
        if any(not safe_name(n) or n not in self.policy['files'] for n in names):
            raise p.PublicationError('Changed files exceed the trusted assignment; nothing staged or committed')
        return names

    def source(self, name):
        parent = os.open(self.path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            for component in PurePosixPath(name).parts[:-1]:
                child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
                os.close(parent)
                parent = child
            fd = os.open(PurePosixPath(name).name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        except FileNotFoundError:
            return None
        finally:
            os.close(parent)
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_FILE:
                raise p.PublicationError('Assigned source is not a bounded regular file')
            value = stream.read(MAX_FILE + 1)
            after = os.fstat(stream.fileno())
        if (info.st_ino, info.st_size, info.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns) or len(value) > MAX_FILE:
            raise p.PublicationError('Source changed during capture; preserve and retest')
        if SECRET.search(value):
            raise p.PublicationError('Potential credential in assigned source; no content logged or committed')
        return {'bytes': value, 'hash': hashlib.sha256(value).hexdigest(), 'mode': '100755' if info.st_mode & 0o111 else '100644'}

    def known_commit(self, request):
        head = self.root / 'head.json'
        if head.exists():
            record = handoff.read(head)
            if record.get('inputKey') == self.input_key(request.get('fileHashes'), request.get('fileModes')):
                return record['commit']
        return None

    def input_key(self, hashes, modes):
        return hashlib.sha256(json.dumps({'base': self.policy['baseCommit'], 'files': hashes,
                                          'modes': modes}, sort_keys=True).encode()).hexdigest()

    def capture(self, request, existing_commit=None):
        if request.get('baseCommit') != self.policy['baseCommit']:
            raise p.PublicationError('Worker handoff does not match approved tested baseline')
        names = self.changes()
        if not names or request.get('files') != names:
            raise p.PublicationError('Handoff must enumerate exactly the changed assigned files')
        captured = {n: self.source(n) for n in names}
        hashes = {n: v['hash'] if v else None for n, v in captured.items()}
        modes = {n: v['mode'] if v else None for n, v in captured.items()}
        if request.get('fileHashes') != hashes or request.get('fileModes') != modes or sum(len(v['bytes']) for v in captured.values() if v) > 64 * 1024 * 1024:
            raise p.PublicationError('Tested source hashes differ or snapshot too large; preserve and retest')
        input_key = self.input_key(hashes, modes)
        head_path = self.root / 'head.json'
        head = handoff.read(head_path) if head_path.exists() else None
        parent = head['commit'] if head else self.policy['baseCommit']
        key = (head['transactionKey'] if head and head.get('inputKey') == input_key else
               hashlib.sha256((input_key + parent).encode()).hexdigest())
        txn = self.root / key
        if existing_commit is not None:
            record = handoff.read(txn / 'commit.json')
            if (record.get('commit') != existing_commit or record.get('files') != hashes or
                    self.git('rev-parse', existing_commit + '^{tree}') != record.get('tree')):
                raise p.PublicationError('Existing publication receipt does not match tested source')
            self.git('merge-base', '--is-ancestor', self.policy['baseCommit'], existing_commit)
            return existing_commit
        private_directory(txn)
        if not (txn / 'snapshot.json').exists():
            for index, name in enumerate(names):
                if captured[name]:
                    if (txn / str(index)).exists():
                        if (txn / str(index)).read_bytes() != captured[name]['bytes']:
                            raise p.PublicationError('Incomplete snapshot content differs; preserve and reconcile')
                        continue
                    fd = os.open(txn / str(index), os.O_CREAT | os.O_WRONLY | os.O_EXCL, 0o600)
                    with os.fdopen(fd, 'wb') as stream:
                        stream.write(captured[name]['bytes']); stream.flush(); os.fsync(stream.fileno())
            if not SHA.fullmatch(parent):
                raise p.PublicationError('Invalid host issue head; preserve and reconcile')
            self.git('merge-base', '--is-ancestor', self.policy['baseCommit'], parent)
            atomic(txn / 'snapshot.json', {'files': hashes, 'createdAt': int(time.time()), 'parent': parent})
        # Recheck even on retry; never publish a previous snapshot over new work.
        if self.changes() != names or any(self.source(n) != captured[n] for n in names):
            raise p.PublicationError('Workspace changed after tests; snapshot preserved, publication held')
        record = handoff.read(txn / 'snapshot.json')
        if record.get('files') != hashes or not isinstance(record.get('createdAt'), int):
            raise p.PublicationError('Preserved snapshot manifest integrity failure; reconcile without deleting it')
        self.git('read-tree', self.policy['baseCommit'])
        for index, name in enumerate(names):
            value = captured[name]
            if value is None:
                self.git('update-index', '--force-remove', '--', name)
            else:
                snapshot = (txn / str(index)).read_bytes()
                if hashlib.sha256(snapshot).hexdigest() != value['hash']:
                    raise p.PublicationError('Preserved snapshot bytes differ; no commit or push')
                blob = self.git('hash-object', '-w', '--stdin', data=snapshot)
                self.git('update-index', '--add', '--cacheinfo', value['mode'] + ',' + blob + ',' + name)
        tree = self.git('write-tree')
        # Fixed parent/tree/message/date make an interrupted commit retry identical.
        self.env.update(GIT_AUTHOR_DATE='@' + str(record['createdAt']) + ' +0000', GIT_COMMITTER_DATE='@' + str(record['createdAt']) + ' +0000')
        parent = record.get('parent')
        if not isinstance(parent, str) or not SHA.fullmatch(parent):
            raise p.PublicationError('Invalid preserved snapshot parent; preserve and reconcile')
        self.git('merge-base', '--is-ancestor', self.policy['baseCommit'], parent)
        revision_paths = self.git('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', parent, tree, '--').split('\0')
        if any(name and name not in self.policy['files'] for name in revision_paths):
            raise p.PublicationError('Draft revision would change files outside the current host assignment')
        self.recheck()
        sha = self.git('commit-tree', tree, '-p', parent, '-m', self.issue + ': verified worker source snapshot')
        self.git('update-ref', 'refs/heads/symphony/' + self.issue, sha)
        atomic(txn / 'commit.json', {'commit': sha, 'tree': tree, 'files': hashes})
        atomic(self.root / 'head.json', {'commit': sha, 'inputKey': input_key, 'transactionKey': key})
        return sha


def publish_source(path, request, root=p.ROOT):
    issue = p.validate(path, root)
    from repository_routes import ALLOWLIST
    if not isinstance(request, dict) or request.get('version') != 2 or request.get('issue') != issue or request.get('repository') not in ALLOWLIST:
        raise p.PublicationError('Invalid source-only handoff identity or body')
    policy = assignment(issue)
    if (request.get('version') != 2 or request.get('issue') != issue or request.get('repository') != policy['repository'] or
            request.get('base') != policy['base'] or request.get('branch') != 'symphony/' + issue or
            not isinstance(request.get('body'), str) or not 0 < len(request['body']) <= 60000):
        raise p.PublicationError('Invalid source-only handoff identity or body')
    artifacts = request.get('artifacts', [])
    if (not isinstance(artifacts, list) or len(artifacts) > 10 or
            any(not isinstance(n, str) or n not in request.get('files', []) or
                not n.lower().endswith(('.png', '.jpg', '.webp', '.webm', '.mp4')) for n in artifacts)):
        raise p.PublicationError('Artifacts must be exact assigned changed media paths')
    ghbin = shutil.which('gh', path=p.TRUSTED_PATH)
    if not ghbin:
        raise p.PublicationError('Install authenticated host GitHub CLI')
    repo = Repository(path, issue)
    repo.recheck()
    p.command([ghbin, 'auth', 'status'], repo.root, repo.env)
    known = repo.known_commit(request)
    items = json.loads(p.command([ghbin, 'pr', 'list', '--repo', policy['repository'], '--head', 'symphony/' + issue,
                                 '--state', 'all', '--json', 'url,state,isDraft,baseRefName,headRefOid,isCrossRepository'], repo.root, repo.env))
    recovering = bool(known and len(items) == 1 and items[0].get('headRefOid') == known and
                      items[0].get('state') == 'OPEN' and items[0].get('isDraft') is True and
                      items[0].get('baseRefName') == policy['base'] and not items[0].get('isCrossRepository'))
    if recovering:
        sha = repo.capture(request, existing_commit=known)
    else:
        if repo.policy.get('publishEnabled') is not True:
            raise p.PublicationError('Host publication held pending independent validation; source and handoff preserved')
        p.workpad(issue)  # Fresh approval is mandatory before every new commit/push.
        repo.fetch_base(ghbin)
        repo.recheck()
        sha = repo.capture(request)
    def recheck_source():
        from repository_routes import verify_source
        repo.recheck()
        try:
            verify_source(policy, lambda endpoint: json.loads(p.command([ghbin, 'api', endpoint], repo.root, repo.env)))
        except Exception:
            raise p.PublicationError('Source revision/identity could not be revalidated; preserve tested handoff') from None
    recheck_source()
    if policy.get('source'):
        request = dict(request, body=request['body'] + '\n\nSymphony source: https://github.com/' + policy['repository'] + '/issues/' + str(policy['source']['number']) + '\nLinear work: ' + policy.get('linearUrl', ''))
    result = p.publish_commit(repo.git, lambda *args: p.command([ghbin, *args], repo.root, repo.env), ghbin,
                              issue, sha, request['body'], repo.gitdir, recheck=recheck_source, artifacts=artifacts, repository=policy['repository'], base_branch=policy['base'])
    result.update(repository=policy['repository'], issue=issue)
    if policy.get('source'):
        result['sourceRevision'] = policy['source']['revision']
    atomic(repo.root / 'receipt.json', result)
    return result
