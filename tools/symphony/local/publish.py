#!/usr/bin/env python3
"""Trusted host after_run publisher. Never execute this from an agent shell."""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import shlex
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
import time
import handoff
import hashlib
from urllib.parse import quote

TRUSTED_PATH = '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin'

REPO = 'adnanwahab/happybearlandia'
BASE = 'sprint/one-city-two-futures-20261111'
ROOT = Path.home() / 'code/symphony-source-only'
STATE = Path.home() / '.local/state/hbl-publisher'


class PublicationError(Exception):
    def __init__(self, message, *, retryable=True):
        super().__init__(message)
        self.retryable = retryable


def command(args, cwd, env=None):
    if args[0] == 'git':
        args = ['/usr/bin/git', *args[1:]]
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=120)
    if result.returncode:
        # Do not persist command output: Git/gh errors can contain credentials.
        raise PublicationError(f'{args[0]} {args[1]} failed (exit {result.returncode}); check host authentication, connectivity and branch divergence; retry after correction')
    return result.stdout.strip()


def _linear_rejection(status, payload):
    # Error bodies can echo input variables, credentials or request headers.
    # Expose only known classifications and selected validation field names.
    allowed_codes = {'BAD_USER_INPUT', 'INPUT_ERROR', 'INVALID_INPUT', 'GRAPHQL_VALIDATION_FAILED',
                     'UNAUTHENTICATED', 'AUTHENTICATION_ERROR', 'AUTHENTICATION_REQUIRED',
                     'FORBIDDEN', 'RATE_LIMITED', 'RATELIMITED', 'INTERNAL_SERVER_ERROR'}
    labels, codes, fields = [], set(), set()
    errors = payload.get('errors', []) if isinstance(payload, dict) else []
    if not isinstance(errors, list):
        errors = []
    for error in errors[:5]:
        if not isinstance(error, dict):
            continue
        extensions = error.get('extensions')
        extensions = extensions if isinstance(extensions, dict) else {}
        code = extensions.get('code')
        if isinstance(code, str) and code in allowed_codes:
            codes.add(code)
        message = error.get('message')
        if isinstance(message, str):
            if message.startswith('Argument Validation Error'):
                labels.append('Argument Validation Error')
            elif message.startswith('Variable '):
                labels.append('GraphQL variable validation failed')
            elif message.startswith('Cannot query field '):
                labels.append('GraphQL field validation failed')
            elif message.startswith('Syntax Error'):
                labels.append('GraphQL syntax error')
        details = extensions.get('validationErrors', [])
        if isinstance(details, list):
            for item in details[:10]:
                name = item.get('property') if isinstance(item, dict) else None
                if isinstance(name, str) and name in {'id', 'issueId', 'body', 'stateId', 'labelId', 'input'}:
                    fields.add(name)
    labels = list(dict.fromkeys(labels))
    summary = '; '.join(labels) or 'response rejected'
    if codes:
        summary += ' [' + ', '.join(sorted(codes)) + ']'
    if fields:
        summary += '; validation fields: ' + ', '.join(sorted(fields))
    retryable = status in (408, 429) or (isinstance(status, int) and status >= 500) or bool(codes & {'INTERNAL_SERVER_ERROR', 'RATE_LIMITED', 'RATELIMITED'})
    return PublicationError(f'Linear request rejected (HTTP {status if status is not None else "unavailable"}): {summary}', retryable=retryable)


def linear(query, variables, *, attempts=3):
    if attempts not in (1, 2, 3):
        raise ValueError('Linear attempts must be 1, 2 or 3')
    key = os.environ.get('LINEAR_API_KEY')
    if not key:
        raise PublicationError('Linear host key unavailable; configure host authentication', retryable=False)
    last_error = None
    for attempt in range(attempts):
        status = None
        try:
            request = urllib.request.Request('https://api.linear.app/graphql',
                data=json.dumps(dict(query=query, variables=variables)).encode(),
                headers={'Authorization': key, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=30) as response:
                value = getattr(response, 'status', None)
                status = value if isinstance(value, int) else None
                try:
                    data = json.load(response)
                except (ValueError, UnicodeError):
                    raise PublicationError(f'Linear invalid JSON response (HTTP {status if status is not None else "unavailable"}); response body omitted', retryable=status is None or status >= 500) from None
            if not isinstance(data, dict) or data.get('errors') or not isinstance(data.get('data'), dict):
                raise _linear_rejection(status, data)
            return data['data']
        except urllib.error.HTTPError as error:
            status = error.code if isinstance(error.code, int) else None
            try:
                raw = error.read(65537)
                payload = json.loads(raw) if len(raw) <= 65536 else None
            except Exception:
                payload = None
            finally:
                error.close()
            last_error = _linear_rejection(status, payload)
        except PublicationError as error:
            last_error = error
        except Exception:
            # Never format URL/transport exceptions: they can contain headers,
            # bearer tokens, credentials, query variables or remote response text.
            last_error = PublicationError(f'Linear host request failed (HTTP {status if status is not None else "unavailable"}); check connectivity and retry')
        if not last_error.retryable:
            raise last_error from None
        if attempt < attempts - 1:
            time.sleep(attempt + 1)
    raise PublicationError(f'{last_error} after {attempts} attempts', retryable=True) from None


def workpad(issue, require_approval=True):
    data = linear('''query($id:String!){issue(id:$id){id identifier state{name}
      labels{nodes{id name} pageInfo{hasNextPage}} comments{nodes{id body} pageInfo{hasNextPage}}}}''', {'id': issue})['issue']
    if not data or data['identifier'] != issue or data['state']['name'] not in ('Todo', 'In Progress', 'Rework'):
        raise PublicationError('Issue missing or no longer active; operator must reconcile')
    if data['labels']['pageInfo']['hasNextPage']:
        raise PublicationError('Incomplete labels; operator must reconcile')
    if require_approval and 'symphony-pilot' not in [x['name'] for x in data['labels']['nodes']]:
        raise PublicationError('Issue lacks symphony-pilot approval')
    pads = [x for x in data['comments']['nodes'] if x['body'].startswith('## Codex Workpad')]
    if data['comments']['pageInfo']['hasNextPage'] or len(pads) != 1:
        raise PublicationError('Need exactly one existing workpad in complete comment page; operator must reconcile')
    pad = pads[0]
    pad['issue_id'] = data['id']
    pad['pilot_label_id'] = next((x['id'] for x in data['labels']['nodes'] if x['name'] == 'symphony-pilot'), None)
    return pad


def archive_workpad(issue, body):
    """Retain exact prior evidence before replacing a current-status section."""
    from coordinator_host import private_directory
    from host_git import atomic
    private_directory(STATE)
    private_directory(STATE / 'workpad-history')
    directory = STATE / 'workpad-history' / issue
    private_directory(directory)
    checksum = hashlib.sha256(body.encode()).hexdigest()
    target = directory / (checksum + '.json')
    if not target.exists():
        atomic(target, {'issue': issue, 'body': body, 'sha256': checksum})


def link(issue, url, sha):
    pad = workpad(issue, require_approval=False)  # Refresh, preserving agent updates on retries.
    archive_workpad(issue, pad['body'])
    marker = f'\n\n### Host GitHub publication\nDraft PR: {url}\nPublished commit: `{sha}`'
    previous = re.sub(r'\n\n### Host GitHub publication\n.*?(?=\n\n### |\Z)', '', pad['body'], flags=re.S)
    body = previous + marker
    data = linear('mutation($id:String!,$body:String!){commentUpdate(id:$id,input:{body:$body}){success}}',
                  {'id': pad['id'], 'body': body})
    if not data['commentUpdate']['success']:
        raise PublicationError('PR exists but Linear workpad update failed; retry to repair link')
    if pad['pilot_label_id']:
        parked = linear('mutation($id:String!,$label:String!){issueRemoveLabel(id:$id,labelId:$label){success}}',
                        {'id': pad['issue_id'], 'label': pad['pilot_label_id']})
        if not parked['issueRemoveLabel']['success']:
            raise PublicationError('PR linked but dispatch label removal failed; stop Symphony and park issue manually')



def validate(path, root=ROOT):
    path = Path(path)
    issue = path.name
    if not re.fullmatch(r'SHE-[1-9][0-9]*', issue):
        raise PublicationError('Expected approved SHE issue identifier')
    if path.is_symlink() or path.absolute() != root.resolve() / issue or path.resolve() != path.absolute():
        raise PublicationError('Workspace must be a direct canonical child of isolated root')
    metadata = path / '.git'
    if not metadata.is_dir() or any(p.is_symlink() for p in metadata.rglob('*')) or metadata.is_symlink():
        raise PublicationError('Independent Git directory required; no metadata symlinks')
    if (metadata / 'objects/info/alternates').exists():
        raise PublicationError('External Git objects forbidden')
    return issue


def publish(path, root=ROOT):
    issue = validate(path, root)
    # Model-authored handoff is data, never shell or a source of repository policy.
    request_path = handoff.pending(path, 'publish')
    if not request_path.exists():
        status_path = STATE / 'workpad-status' / (issue + '.json')
        if status_path.exists() and handoff.read(status_path).get('status') == 'handoff':
            receipt = STATE / 'host-git' / issue / 'receipt.json'
            if receipt.exists():
                result = handoff.read(receipt)
                if result.get('status') == 'published' and re.fullmatch('[0-9a-f]{40}', str(result.get('commit', ''))):
                    return result
            raise PublicationError('Terminal handoff has no publication artifact or completed receipt; park, never repeat implementation')
        return {'status': 'no-request'}
    request = handoff.read(request_path)
    if request.get('version') == 2:
        status_path = STATE / 'workpad-status' / (issue + '.json')
        if not status_path.exists() or handoff.read(status_path).get('status') != 'handoff':
            raise PublicationError('Source publication requires a successfully synchronized terminal handoff workpad')
        from host_git import publish_source
        return publish_source(path, request, root)
    sha = request.get('commit', '')
    branch = f'symphony/{issue}'
    if (request.get('issue') != issue or request.get('branch') != branch or
        request.get('base') != BASE or request.get('repository') != REPO or
        not re.fullmatch('[0-9a-f]{40}', sha)):
        raise PublicationError('Invalid issue, repository, branch, base or full commit in handoff')
    body = request.get('body', '')
    if not isinstance(body, str) or not body.strip() or len(body) > 60000:
        raise PublicationError('PR body required (maximum 60000 characters)')
    # Never load workspace Git configuration on the authenticated host. Only read
    # validated object storage through a disposable, host-owned bare repository.
    with tempfile.TemporaryDirectory(prefix='hbl-publisher-') as tmp:
        env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'GH_', 'GITHUB_', 'LINEAR_'))}
        env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0')
        env['PATH'] = TRUSTED_PATH
        command(['git', 'init', '--bare', tmp], tmp, env)
        gitdir = Path(tmp)
        (gitdir / 'worker-excludes').write_text('.hbl-handoff/\n')
        env['GIT_CONFIG_COUNT'] = '2'
        env['GIT_CONFIG_KEY_0'], env['GIT_CONFIG_VALUE_0'] = 'core.hooksPath', '/dev/null'
        env['GIT_CONFIG_KEY_1'], env['GIT_CONFIG_VALUE_1'] = 'core.excludesFile', str(gitdir / 'worker-excludes')
        (gitdir / 'objects/info/alternates').write_text(str(path / '.git/objects') + '\n')
        def git(*args):
            return command(['git', *args], tmp, env)
        if (path / '.git/HEAD').read_text().strip() != f'ref: refs/heads/{branch}':
            raise PublicationError('Checked-out branch must be the exact issue branch')
        # Resolve refs and index with trusted config, without reading local config.
        env.update(GIT_WORK_TREE=str(path), GIT_INDEX_FILE=str(path / '.git/index'))
        ref = path / '.git/refs/heads' / branch
        # Independent pilot clones create loose issue refs; fail closed otherwise.
        if not ref.is_file() or ref.read_text().strip() != sha:
            raise PublicationError('Requested commit must match local issue HEAD (loose ref required)')
        if git('cat-file', '-t', sha) != 'commit':
            raise PublicationError('Handoff SHA must identify a commit object')
        from host_git import assignment, SECRET, MAX_FILE
        policy = assignment(issue)
        if policy.get('publishEnabled') is not True:
            raise PublicationError('Legacy publication held by trusted assignment; source preserved')
        git('merge-base', '--is-ancestor', policy['baseCommit'], sha)
        names = git('diff', '--no-renames', '--name-only', '-z', policy['baseCommit'], sha, '--').split('\0')
        for name in filter(None, names):
            if name not in policy['files']:
                raise PublicationError('Legacy commit exceeds trusted assigned file scope')
            ignored = subprocess.run(['/usr/bin/git', 'check-ignore', '--no-index', '--', name], cwd=tmp, env=env,
                                     capture_output=True, timeout=120)
            if ignored.returncode != 1:
                raise PublicationError('Legacy assigned file is ignored or ignore check failed; nothing published')
            entry = git('ls-tree', sha, '--', name)
            if not entry:
                continue
            if entry.split()[0] not in ('100644', '100755'):
                raise PublicationError('Legacy publication refuses symlinks and submodules')
            if int(git('cat-file', '-s', sha + ':' + name)) > MAX_FILE:
                raise PublicationError('Legacy assigned file exceeds size bound')
            blob = subprocess.run(['/usr/bin/git', 'cat-file', 'blob', sha + ':' + name], cwd=tmp, env=env,
                                  capture_output=True, timeout=120)
            if blob.returncode or SECRET.search(blob.stdout):
                raise PublicationError('Legacy file unreadable or potential credential; no content logged')
        tree = git('write-tree')
        if tree != git('rev-parse', sha + '^{tree}') or git('diff-files', '--name-only') or git('ls-files', '--others', '--exclude-standard'):
            raise PublicationError('Workspace/index must be clean and fully committed')
        allowed = {'https://github.com/' + REPO + '.git', 'https://github.com/' + REPO, 'git@github.com:' + REPO + '.git'}
        origin = command(['git', 'config', '--file', str(path / '.git/config'), '--no-includes', '--get', 'remote.origin.url'], tmp, env)
        if origin not in allowed:
            raise PublicationError('Workspace origin is not the allowed repository')
        ghbin = shutil.which('gh', path=TRUSTED_PATH)
        if not ghbin:
            raise PublicationError('Install authenticated host GitHub CLI')
        def gh(*args):
            return command([ghbin, *args], tmp, env)
        def recheck():
            if assignment(issue) != policy:
                raise PublicationError('Host assignment changed during publication; preserve and reconcile')
        return publish_commit(git, gh, ghbin, issue, sha, body, gitdir, recheck=recheck)


def publish_commit(git, gh, ghbin, issue, sha, body, gitdir, recheck=lambda: None, artifacts=(), repository=REPO, base_branch=BASE):
    from repository_routes import approved_route
    route = approved_route(repository, STATE)
    if route["base"] != base_branch:
        raise PublicationError("Publication route differs from private operator policy")
    branch = f'symphony/{issue}'
    def prs():
        return json.loads(gh('pr', 'list', '--repo', repository, '--head', branch, '--state', 'all', '--json', 'url,state,isDraft,baseRefName,headRefOid,isCrossRepository'))
    def check(items):
        if len(items) > 1 or any(p['state'] != 'OPEN' or not p['isDraft'] or p['baseRefName'] != base_branch or p['isCrossRepository'] for p in items):
            raise PublicationError('Existing PR is closed, merged, non-draft, duplicated or wrong-base; operator reconciliation required')
    items = prs()
    check(items)
    current = bool(items and items[0]['headRefOid'] == sha)
    recheck()
    if not current:
        workpad(issue)  # Approval required before every push.
        base = json.loads(gh('api', f'repos/{repository}/git/ref/heads/{base_branch}'))['object']['sha']
        git('-c', 'credential.helper=', '-c', f'credential.helper=!{shlex.quote(ghbin)} auth git-credential', 'fetch', '--no-tags', 'https://github.com/' + repository + '.git', base_branch)
        if git('rev-parse', 'FETCH_HEAD') != base:
            raise PublicationError('Base changed during validation; retry')
        git('merge-base', '--is-ancestor', base, sha)
        if sha == base:
            raise PublicationError('No issue commit beyond base')
        # Explicit SHA/refspec, no force, hooks, local remotes or local helpers.
        recheck()
        git('-c', 'credential.helper=', '-c', f'credential.helper=!{shlex.quote(ghbin)} auth git-credential',
            '-c', 'core.hooksPath=/dev/null', 'push', 'https://github.com/' + repository + '.git', f'{sha}:refs/heads/{branch}')
    # The worker cannot predict a host commit. Resolve uploaded media only after
    # push, verify GitHub's exact blob identity, then append the actual URL.
    for name in artifacts:
        recheck()
        remote = json.loads(gh('api', f'repos/{repository}/contents/{quote(name, safe="/")}?ref={sha}'))
        if remote.get('sha') != git('rev-parse', sha + ':' + name):
            raise PublicationError('Uploaded artifact identity not yet verified; preserve draft handoff and retry')
        body += f'\n\nVerified committed artifact: https://github.com/{repository}/blob/{sha}/{quote(name, safe="/")}?raw=true'
    bodyfile = Path(gitdir) / 'pr-body.txt'
    bodyfile.write_text(body)
    recheck()
    if items and not current:
        gh('pr', 'edit', items[0]['url'], '--repo', repository, '--body-file', str(bodyfile))
    if not items:
        try:
            gh('pr', 'create', '--repo', repository, '--draft', '--base', base_branch, '--head', branch,
               '--title', f'{issue}: Symphony pilot', '--body-file', str(bodyfile))
        except PublicationError:
            # A timeout may mean GitHub accepted the create. Reconcile before retry.
            items = prs()
            if not items:
                raise
    items = prs()
    check(items)
    if len(items) != 1 or items[0]['headRefOid'] != sha:
        raise PublicationError('PR HEAD not yet current; retry to reconcile')
    recheck()
    link(issue, items[0]['url'], sha)
    return {'status': 'published', 'commit': sha, 'url': items[0]['url']}


def main():
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = Path.cwd()
    issue = validate(path)
    with (STATE / f'{issue}.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            result = publish(path)
        except Exception as exc:
            result = {'status': 'error', 'action': str(exc) if isinstance(exc, PublicationError) else
                      f'{type(exc).__name__}: host publication interrupted; verify connectivity/auth and retry; existing PR will be reconciled'}
        target = STATE / f'{issue}.json'
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(result, indent=2) + '\n')
        temporary.replace(target)
        print(json.dumps(result))
        return int(result['status'] == 'error')


if __name__ == '__main__':
    # host_git/workpad import publish by its canonical name. Run that same
    # module's entry point so its safe PublicationError class is shared, rather
    # than hiding expected rejections behind a second __main__ class identity.
    from publish import main as cli_main
    sys.exit(cli_main())
